/* eslint-disable no-param-reassign */
import { isProd } from '../utils'
import {
  createEmbeddedEnvelope,
  createEnvelope,
  getEnvelopes,
} from './docusign-api'
import {
  allCheckBoxNames,
  getDocuSignCustomFieldData,
} from '../controllers'
import {
  getApplicationPersons,
  getCart,
  getChangeForms,
  getDocuSignApplicationTemplate,
  getFamily,
  getHealthBundle,
  getPrimarySigner,
  getSigners,
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
    templateRoles.push(...generateSigners(signers))
  }

  return {
    compositeTemplates,
    templateRoles,
  }
}

export const setDocuSignEnvelopeSigningStatus = async (event) => {
  const { envelopeId, employeePublicKey, personPublicKey } = event.body

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
      const applicants = getApplicationPersons(benefit.Persons, event.primary, event.family)
      const signers = getSigners(applicants)

      if (benefit.DocuSignEnvelopeId === envelopeId) {
        benefit.PdfSignatures = signers.map((signer) => {
          if (signer.clientUserId === personPublicKey) {
            return {
              Id: signer.clientUserId,
              Signed: true,
            }
          }
          return {
            Id: signer.clientUserId,
            Signed: false,
          }
        })
      }

      // if all signers have signed, then mark envelope as COMPLETE!
      if (benefit.PdfSignatures && benefit.PdfSignatures.every(signer => (signer.Signed === true))) {
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
  // 'worker' is 'primary'
  const { employeePublicKey, returnUrl } = request
  const clientUserId = `${employeePublicKey}`
  const email = `${worker.HixmeEmailAlias}`.toLowerCase()
  const name = [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
  const recipientId = '1'

  const { HealthPlanId = '' } = benefit
  const [template = {}] = await getDocuSignApplicationTemplate(HealthPlanId)
  const { TemplateId: matchedTemplateId = null } = template
  // 'Prod' DS: https://app.docusign.com     [services@hixme.com]
  // 'Int'  DS: https://appdemo.docusign.com [docusign@hixme.com]
  const cancelationForms = await getChangeForms({
    employeePublicKey: `${employeePublicKey}`,
    HIOS: `${HealthPlanId}`,
  })
  const defaultForms = {
    application: isProd ? 'b9bcbb3e-ad06-480f-8639-02e3d5e6acfb' : '0b1c81d0-703d-49bb-861a-c0e2509ba142',
    cancelation: isProd ? 'b59a56bd-4990-488e-a43f-bf37ad00a63b' : '79a9dad3-011c-4094-9c01-7244b9303338',
  }
  // in PROD: we attempt to match HIOS w/ its relevant (docusign) templateId
  // if match found, use that templateId; otherwise, default to 'base' application form template
  // in INT / DEV: we default to using the 'base' appplication form template for everyone;
  // to test other templates in INT, they must each be copied over from Hix' PROD-docusign account
  const applicationFormId = isProd ? (matchedTemplateId || defaultForms.application) : defaultForms.application

  const fields = getDocuSignCustomFieldData({
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

  const body = getTemplateJSON({
    fields,
    signers,
    compositeTemplates: generateComposedTemplates(
      // [applicationFormId, cancelationForms],
      [applicationFormId],
      generateSigners(signers, fields),
    ),
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
  } = request
  let {
    clientUserId,
    recipientId,
    // TODO: REMOVE THE TWO BELOW!!
    email,
    name,
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

  const { primary: worker = {} } = data
  email = email || `${worker.HixmeEmailAlias}`.toLowerCase()
  name = name || [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
  clientUserId = clientUserId || `${employeePublicKey}`
  recipientId = recipientId || '1'

  const payload = {
    params: {
      envelopeId,
    },
    body: JSON.stringify({
      ...request,
      authenticationMethod: 'email',
      clientUserId,
      email,
      recipientId,
      returnUrl,
      userName: name, // notice that ww're passing 'userName'; not 'user'
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
