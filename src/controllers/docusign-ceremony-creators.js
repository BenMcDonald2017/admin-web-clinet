/* eslint-disable no-param-reassign */
import { map } from 'lodash'

import { createEnvelope, getEnvelopes, createEmbeddedEnvelope } from './docusign-api'
import { getDocuSignCustomFieldData } from '../controllers'
import { saveCart, getCart, getFamily, getHealthBundle, getPrimarySigner } from '../resources'
import { getSigners, getApplicationPersons } from '../resources/family'

const getTemplateJSON = (user, templateId, fields) => ({
  templateId,
  templateRoles: [{
    roleName: 'Worker',
    ...user,
    tabs: {
      textTabs: map(fields, (value, tabLabel) => ({
        tabLabel,
        value,
      })),
    },
  }],
})

function envelopeIsCompleted(e) {
  const status = e && `${e.status}`.toLowerCase()
  return status === 'completed'
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
    // if the item in the cart has no docusignID, then give it one!
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
  const { envelopeId } = event.params
  event.envelopeId = envelopeId

  event.result = await getEnvelopes({
    query: {
      envelope_ids: `${event.envelopeId}`,
    },
  })

  const { envelopes } = event.result
  event.result.exists = !!(envelopes && envelopes.length)

  const { envelopes: envelopesExist } = event.result

  const allEnvelopesAreSigned = (envelopesExist && envelopes.every(envelopeIsCompleted))
  event.result.completed = (envelopesExist && allEnvelopesAreSigned)
}

function getDocuSignTemplateId(healthPlanId) {
  switch (process.env.STAGE) {
    case 'prod':
      switch (healthPlanId) {
        case '123':
        case '456':
        case '789':
          return '99999999-9999-9999-9999-999999999999'
        default:
          // everything in 'prod' will fall through to default template:
          return 'b9bcbb3e-ad06-480f-8639-02e3d5e6acfb'
      }
    case 'int':
    case 'dev':
    default:
      switch (healthPlanId) {
        default:
          // everything in 'int' and 'dev' will fall through to default template:
          return 'a56ec5bc-5a0b-4d65-b225-dc81378f9650'
      }
  }
}

export const createDocuSignEnvelope = async (event, data) => {
  // TODO: *********************************
  // TODO: VALIDATE of USERS' AUTHORIZATION!
  // TODO: *********************************

  const request = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  const { employeePublicKey, returnUrl } = request

  const {
    // cart,
    // family,
    healthBundle,
    primary,
  } = data
  const clientUserId = event.isOffline ? '123' : employeePublicKey
  const email = `${primary.HixmeEmailAlias}`.toLowerCase()
  const name = `${primary.FirstName} ${primary.LastName}`
  const recipientId = '1'

  const body = getTemplateJSON({
    clientUserId,
    email,
    name,
    recipientId,
    returnUrl,
  }, getDocuSignTemplateId(`${healthBundle.HealthPlanId}`), getDocuSignCustomFieldData(data))

  body.emailSubject = `Signature Request: ${name}`
  body.status = 'sent' // indicates to DS that this _isn't_ a draft
  body.fromDate = new Date()

  const envelope = await createEnvelope({ body: JSON.stringify(body) })
  const { envelopeId } = envelope

  event.envelope = {
    created: true,
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

  const { primary } = data

  const clientUserId = event.isOffline ? '123' : employeePublicKey
  const email = `${primary.HixmeEmailAlias}`.toLowerCase()
  const name = `${primary.FirstName} ${data.primary.LastName}`
  const recipientId = '1'

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
      userName: name, // when creating, we passed in 'name'; but, when fetching,
      // we pass in 'userName'.  Dumb.
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
