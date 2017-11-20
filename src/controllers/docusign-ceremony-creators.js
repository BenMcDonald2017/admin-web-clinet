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
  getCart,
  getChangeForms,
  getDocuSignApplicationTemplate,
  getFamily,
  getHealthBundle,
  getPrimarySigner,
  saveCart,
} from '../resources'
import {
  generateAllTabData,
  generateSigners,
  generateComposedTemplates,
} from './docusign-helpers'

const getTemplateJSON = ({
  fields,
  signers,
  compositeTemplates,
  userData,
}) => {
  const templateRoles = [{ roleName: 'Worker', ...userData, tabs: generateAllTabData(fields) }]
  signers = signers.filter(signer => (signer.clientUserId !== userData.clientUserId))

  if (signers.length) {
    templateRoles.push(...generateSigners(signers, fields))
  }

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

  event.healthBundle.Benefits = await Promise.all(event.healthBundle.Benefits.map(async (benefit) => {
    // check if the benefit has an envelopeId
    if (benefit.DocuSignEnvelopeId) {
      if (benefit.DocuSignEnvelopeId === envelopeId) {
        benefit.PdfSignatures = benefit.PdfSignatures.map(({ Signed = false, Id = '' }) => {
          if (Signed || Id === personPublicKey) {
            return {
              Id,
              Signed: true,
            }
          }
          return {
            Id,
            Signed: false,
          }
        })
      }

      const { PdfSignatures } = benefit
      // if all signers have signed, then mark envelope as COMPLETE!
      if (PdfSignatures && PdfSignatures.every(signer => (signer.Signed === true))) {
        benefit.EnvelopeComplete = true
      }

      event.result = { success: true }
      return benefit
    }

    event.result = { success: false }
    return benefit
  }))

  await saveCart(event.cart)
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
  const { TemplateId: matchedTemplateId = null } = template

  const changeOrCancelationForms = await getChangeForms({
    employeePublicKey,
    HIOS,
  })

  // in PROD: we attempt to match HIOS w/ its relevant (docusign) templateId
  // if match found, use that templateId; otherwise, default to 'base' application form template
  // in INT / DEV: we default to using the 'base' appplication form template for everyone;
  // to test other templates in INT, they must each be copied over from Hix' PROD-docusign account

  const baseApplicationForm = isProd ? 'b9bcbb3e-ad06-480f-8639-02e3d5e6acfb' : '0b1c81d0-703d-49bb-861a-c0e2509ba142'
  const applicationFormId = isProd ? (matchedTemplateId || baseApplicationForm) : baseApplicationForm

  console.warn(`${employeePublicKey}: is Prod? - ${isProd}`)
  console.warn(`${employeePublicKey}: cancelation form id(s) returned from 'get-change-forms': ${changeOrCancelationForms}`)
  console.warn(`${employeePublicKey}: base application id returned from 'prod-carrier-application-hios': ${matchedTemplateId}`)
  console.warn(`${employeePublicKey}: base application form id used:': ${applicationFormId}`)

  const fields = await getDocuSignCustomFieldData({
    benefit,
    family,
    signers,
    worker,
  })

  const userData = {
    clientUserId,
    email,
    name,
    recipientId,
    returnUrl,
  }

  const formattedSignersArray = await generateSigners(signers, fields)
  const compositeTemplates = await generateComposedTemplates(
    [...changeOrCancelationForms, applicationFormId],
    formattedSignersArray,
  )

  console.warn(`${employeePublicKey}: FINAL composite templates being used:': ${[...changeOrCancelationForms, applicationFormId]}`)

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

  // call out to docusign and create the envelope
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
