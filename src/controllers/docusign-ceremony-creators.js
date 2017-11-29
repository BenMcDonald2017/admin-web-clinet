/* eslint-disable no-param-reassign */
import QS from 'qs'
import { isProd } from '../utils'
import {
  createEmbeddedEnvelope,
  createEnvelope,
  getEnvelopes,
} from './docusign-api'
import {
  getDocuSignCustomFieldData,
} from '../controllers'
import {
  EFFECTIVE_DATE,
  effectiveAge,
  getCart,
  getChangeOrCancelationForms,
  getDocuSignApplicationTemplate,
  getFamily,
  getHealthBundle,
  getPrimarySigner,
  saveCart,
} from '../resources'
import {
  generateComposedTemplates,
  generateSigners,
} from './docusign-helpers'

const getTemplateJSON = ({
  compositeTemplates,
  fields,
  signers,
  userData,
}) => {
  const templateRoles = []
  templateRoles.push(...generateSigners(signers, fields))

  return {
    compositeTemplates,
    templateRoles,
  }
}

export const setDocuSignEnvelopeSigningStatus = async (event) => {
  const { envelopeId = '', employeePublicKey = '', personPublicKey = '' } = event.body

  const [theFamily, { Item: theCart }] = await Promise.all([
    getFamily(employeePublicKey),
    getCart(employeePublicKey),
  ])

  event.family = theFamily
  event.cart = theCart

  if (event.cart) {
    event.healthBundle = getHealthBundle(event.cart.Cart)
  }

  if (event.healthBundle) {
    event.primary = getPrimarySigner(event.healthBundle, event.family)
  }

  event.healthBundle.Benefits = event.healthBundle.Benefits.map(async (benefit) => {
    // check if the benefit has an envelopeId, and if it has the correct one
    const {
      PdfSignatures = [],
      DocuSignEnvelopeId = '',
    } = benefit

    if (DocuSignEnvelopeId === envelopeId) {
      benefit.PdfSignatures = PdfSignatures.map((signer) => {
        if (personPublicKey === signer.Id) {
          signer.Signed = true
        }
        return signer
      })
    }
    // if all signers have signed, then mark envelope as true (a.k.a., COMPLETE)!
    benefit.EnvelopeComplete = PdfSignatures.every(signer => signer.Signed === true)

    await saveCart(event.cart)

    event.result = { success: true }
    return benefit
  })
}

export const getDocuSignEnvelope = async (event) => {
  const { envelopeId: envelope_ids } = event.params

  const { envelopes } = await getEnvelopes({ query: { envelope_ids } })

  event.result = {
    ...event.result,
    envelopes,
    exists: !!envelopes.length,
    completed: envelopes.every(e => /^completed$/i.test(e.status)),
  }
}

export const createDocuSignEnvelope = async (benefit, worker, family, signers, event) => {
  const request = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  const { employeePublicKey, returnUrl } = request
  const clientUserId = `${employeePublicKey}`
  const email = `${worker.HixmeEmailAlias}`.toLowerCase()
  const name = [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
  const recipientId = `${employeePublicKey}`

  const { HealthPlanId: HIOS = '' } = benefit
  const [template = {}] = await getDocuSignApplicationTemplate(HIOS)
  const { TemplateId: matchedDocuSignTemplateId = null } = template

  const changeOrCancelationFormDocuSignIds = await getChangeOrCancelationForms({
    employeePublicKey,
    HIOS,
  })

  const isCaliforniaPlan = /\d{5}(?:CA)/.test(HIOS)

  // in PROD: we attempt to match HIOS w/ its relevant DocuSign `templateId`
  // if match found, use that `templateId`; otherwise, default to the Hixme, Inc-
  // created, 'base' application form DocuSign `templateId`. ##################
  // in INT / DEV: we default to using the 'base' appplication form template for everyone;
  // to test other templates in INT, they must each be copied over from Hix' PROD-DocuSign account
  const kaiserChangeFormDocuSignIds = ['cbeeae49-56de-4065-95b8-97b6fafb2189', '5a450cb3-da73-44d9-8eba-e0902073fc00']
  const baseHixmeAppFormDocuSignId = isProd ? 'b9bcbb3e-ad06-480f-8639-02e3d5e6acfb' : '0b1c81d0-703d-49bb-861a-c0e2509ba142'
  let appFormToUseDocuSignId = /* isProd ?
    // prod is set to their matched template, or else, the hixme base form:
    (((isCaliforniaPlan && false) ? matchedDocuSignTemplateId : null) || baseHixmeAppFormDocuSignId) :
    // non-prod environments ALWAYS receive hixme base form(, for now ...
    // and until we copy over confirmed, tested, anx verified forms from
    // DocuSign-prod over to DocuSign-int): */
    baseHixmeAppFormDocuSignId

  // if the user was given the kaiser change form, then remove the otherwise-selected base form
  console.warn(`${employeePublicKey}: kaiser change form detected. removing base form in preference to the change form!`)
  if (changeOrCancelationFormDocuSignIds.some(formId => kaiserChangeFormDocuSignIds.includes(formId))) {
    appFormToUseDocuSignId = ''
  }

  console.warn(`${employeePublicKey}: is Prod? - ${isProd}`)
  console.warn(`${employeePublicKey}: cancelation form id(s) returned from 'get-change-forms': ${changeOrCancelationFormDocuSignIds}`)
  console.warn(`${employeePublicKey}: base application id returned from 'prod-carrier-application-hios': ${matchedDocuSignTemplateId}`)
  console.warn(`${employeePublicKey}: base application form id used:': ${appFormToUseDocuSignId}`)

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
    returnUrl,
  }

  const formsToUse = [...changeOrCancelationFormDocuSignIds, appFormToUseDocuSignId].filter(form => form && form != null)

  const isUsingBaseAppTemplate = appFormToUseDocuSignId === baseHixmeAppFormDocuSignId

  const [{ Item: theCart }] = await Promise.all([
    getCart(employeePublicKey),
  ])

  event.cart = theCart

  if (event.cart) {
    event.healthBundle = getHealthBundle(event.cart.Cart)
    event.healthBundle.isUsingBaseAppTemplate = Boolean(isUsingBaseAppTemplate)
  }

  await saveCart(event.cart)

  const under18Ids = family.filter(person => effectiveAge(`${person.DateOfBirth}`, `${EFFECTIVE_DATE}`) < 18).map(mc => mc.Id)
  signers = signers.filter(signer => !under18Ids.includes(signer.clientUserId))

  // if benefit have only dependents, and none of those dependents are under 18, then remove the worker from the signatures list—they don't need to sign
  if (benefit.Persons && benefit.Persons.every(person => /child/i.test(person.Relationship) && !under18Ids.includes(person.Id))) {
    signers = signers.filter(signer => signer.clientUserId !== `${employeePublicKey}`)
  }

  const formattedSignersArray = await generateSigners(signers, fields)
  const compositeTemplates = await generateComposedTemplates(
    formsToUse,
    formattedSignersArray,
  )

  console.warn(`${employeePublicKey}: FINAL composite templates being used:': ${formsToUse}`)

  const body = await getTemplateJSON({
    fields,
    signers,
    compositeTemplates,
    userData,
  })

  body.EmailBlurb = `Signature Request: ${name}`
  body.Subject = `Signature Request: ${name}`
  body.emailSubject = `Signature Request: ${name}`
  body.status = 'sent' // indicates it's _NOT_ a draft
  body.fromDate = new Date()

  // call out to DocuSign and create the envelope
  const envelope = await createEnvelope({ body: JSON.stringify(body) })

  // grab 'envelopeId' from 'envelope'
  const { envelopeId = null } = envelope

  event.envelope = {
    created: !!envelopeId,
    envelopeId,
    clientUserId,
  }
}

export const createDocuSignEmbeddedEnvelope = async (event) => {
  const request = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  // const { authorizer } = event.requestContext
  // const { claims } = authorizer

  const data = {}
  const {
    employeePublicKey,
    envelopeId,
    returnUrl,
    userId,
  } = request

  const [theFamily, { Item: theCart }] = await Promise.all([
    getFamily(employeePublicKey),
    getCart(employeePublicKey),
  ])

  data.family = theFamily
  data.cart = theCart

  if (data.cart) {
    data.healthBundle = getHealthBundle(data.cart.Cart)
    data.primary = getPrimarySigner(data.healthBundle, data.family)
  }

  const { primary: worker = {}, healthBundle } = data
  const { id: parsedUserId } = QS.parse(decodeURIComponent(`${returnUrl}`), { delimiter: /[?&]/ })

  // set the signer to the primary worker by default
  let signer = worker

  // if someone's `id` was found in the querystring (for `id` param) of the `returnUrl`, then...
  if (parsedUserId) {
    // `signer` can be undefined/null if `returnUrl` contains `id` param but itsn't valid match during `.find()`
    signer = data.family.find(familyMember => familyMember.Id === parsedUserId)
  }

  // NOTE: there are many other unhandled states of error ...should fix.
  if (!signer || signer == null) throw new Error('could not parse out a valid, necessary param. try again.')

  const { Id: id } = signer // || parsedUserId || employeePublicKey || userId
  const payload = {
    params: {
      envelopeId,
    },
    body: JSON.stringify({
      authenticationMethod: 'password',
      clientUserId: id || undefined,
      recipientId: id || undefined,
      returnUrl: returnUrl || undefined,
      // userId: parsedUserId || userId,
      email: `${signer.HixmeEmailAlias}`.toLowerCase(),
      // v— notice here, using 'userName'; not 'user' —v
      userName: [signer.FirstName, signer.MiddleName, signer.LastName].filter(e => e && e != null).join(' '),
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
