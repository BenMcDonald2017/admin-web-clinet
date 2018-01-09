// import moment from 'moment'
import { get } from 'delver'
import ware from 'warewolf'
import { before, after, isSetToTrue, isProd } from '../../utils'
import {
  EFFECTIVE_DATE,
  effectiveAge,
  getChangeOrCancelationForms,
  getCurrentYearPlan,
  getDocuSignApplicationTemplate,
  getFamily,
  getPreviousYearPlan,
  getPrimarySigner,
} from '../../resources'
import {
  createEnvelope,
  generateComposedTemplates,
  generateSigners,
  getDocuSignCustomFieldData,
} from '../../controllers'

const genericCancelation = isProd ? 'b59a56bd-4990-488e-a43f-bf37ad00a63b' : '79a9dad3-011c-4094-9c01-7244b9303338'

export const cancelPreviousHealthBenefits = ware(
  before,

  async (event) => {
    const { employeePublicKey: epk } = event.params
    event.employeePublicKey = epk

    // ensure our POST has payload containing "cancel" === true (or 'yes' or 1)
    if (!isSetToTrue(get(event.body, 'cancel'))) throw new Error('"cancel" was not set to true')

    event.currentPlan = await getCurrentYearPlan(event.employeePublicKey)
    event.previousPlan = await getPreviousYearPlan(event.employeePublicKey)

    // Selecting only the first plan here, fyi...
    event.currentPlan = (event.currentPlan && event.currentPlan.length) ? event.currentPlan[0] : event.currentPlan
    event.previousPlan = (event.previousPlan && event.previousPlan.length) ? event.previousPlan[0] : event.previousPlan
  },

  async (event) => {
    // if worker had no previous plan, then there's no cancelation form to
    // generate since there's nothing to cancel! In this case we throw an error.
    if (!event.previousPlan) throw new Error(`no previous plan found for EPK: ${event.employeePublicKey}`)
    // if worker doesn't have a current plan, that's A-OK.  Logging it for more info.
    if (!event.currentPlan) { console.warn('FYI: This worker has no current plan(s)!') }
  },

  async (event) => {
    // at this point, we know that the worker has, at least, 1+ previous plan(s)...
    // so, let's generate some cancelation docusigns!
    await generateCancalationForm(event)
  },

  after,
)

export const generateCancalationForm = async (event) => {
  event.family = await getFamily(event.employeePublicKey)
  event.primary = getPrimarySigner(event.previousPlan, event.family)

  event.signers = event.previousPlan && event.previousPlan.Persons.filter(person => /^included$/i.test(person.BenefitStatus))
  // filter out signers that are under 18
  const under18Ids = event.family.filter(person => effectiveAge(`${person.DateOfBirth}`, `${EFFECTIVE_DATE}`) < 18).map(minorChild => minorChild.Id)
  event.signers = event.signers.filter(signer => !under18Ids.includes(signer.Id))

  if (event.previousPlan && event.previousPlan.Persons.every(person => /child/i.test(person.Relationship))) {
    // if benefit has only children deps then add primary to signers list
    event.signers = [event.primary, ...event.signers]
    if (event.previousPlan.Persons.every(person => !under18Ids.includes(person.Id))) {
      // if benefit have only dependents, and none of those dependents are under 18, then remove the worker from the signatures list—they don't need to sign
      event.signers = event.signers && event.signers.filter(signer => signer.Id !== `${event.primary.Id}`)
    }
  }

  // set return url:
  event.returnUrl = 'https://google.com'

  /* eslint-disable function-paren-newline */
  event.result = await createDocuSignEnvelopeForCancelationOfPreviousPlan(
    event.previousPlan, event.primary, event.family, event.signers, event,
  )
}

/* eslint-disable max-len */
const createDocuSignEnvelopeForCancelationOfPreviousPlan = async (benefit, worker, family, signers, event) => {
  const clientUserId = `${event.employeePublicKey}`
  const email = `${worker.HixmeEmailAlias}`.replace(/\s+/g, '').toLowerCase()
  const name = worker.name ? worker.name : [worker.FirstName, worker.LastName].filter(n => n && n != null).join(' ')
  const recipientId = `${event.employeePublicKey}`

  const { HealthPlanId: HIOS = '' } = benefit
  // const [template = {}] = await getDocuSignApplicationTemplate(HIOS)
  // const { TemplateId: matchedDocuSignTemplateId = null } = template
  // const isCaliforniaPlan = /\d{5}(?:CA)/.test(HIOS)

  const fields = await getDocuSignCustomFieldData({
    benefit,
    family,
    signers,
    worker,
    event,
  })

  const userData = {
    clientUserId,
    email,
    name,
    recipientId,
    returnUrl: event.returnUrl,
  }

  const formattedSignersArray = await generateSigners(event.signers, fields)
  const compositeTemplates = await generateComposedTemplates(
    [genericCancelation], // an Array of 1+ docusign template IDs
    formattedSignersArray,
  )

  const documentData = getTemplateJSON({
    compositeTemplates,
    fields,
    signers,
  })

  const payload = {
    ...documentData,
    EmailBlurb:   `Plan Cancelation: ${name}`,
    emailSubject: `Plan Cancelation: ${name}`,
    fromDate:     new Date(),
    status:       'sent', // indicates it's _NOT_ a draft
    Subject:      `Plan Cancelation: ${name}`,
    notification: {
      useAccountDefaults:  false,
      reminders: {
        reminderEnabled:   true,
        reminderDelay:     0,
        reminderFrequency: 0,
      },
      expirations: {
        expireEnabled:     true,
        expireAfter:       120,
        expireWarn:        0,
      },
    },
  }

  // call out to DocuSign and create the envelope
  const envelope = await createEnvelope({ body: JSON.stringify(payload) })

  // grab 'envelopeId' from 'envelope'
  const { envelopeId = null } = envelope

  event.envelope = {
    created: !!envelopeId,
    envelopeId,
    clientUserId,
  }

  return event.envelope
}

const getTemplateJSON = ({
  compositeTemplates,
  fields,
  signers,
}) => {
  const templateRoles = []
  templateRoles.push(...generateSigners(signers, fields))

  return {
    compositeTemplates,
    templateRoles,
  }
}
