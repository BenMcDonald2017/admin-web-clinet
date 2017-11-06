/* eslint-disable no-param-reassign */
import { map } from 'lodash'

import { createEnvelope, getEnvelopes, createEmbeddedEnvelope } from './docusign-api'
import { getDocuSignCustomFieldData } from '../controllers'
import { getCart, getFamily, getHealthBundle, getPrimarySigner } from '../resources'

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
          return 'b095e9e2-ef99-4100-bb4d-19d01783823a'
      }
    case 'int':
    case 'dev':
    default:
      return '2dda4584-dc4b-4502-870c-19920ed987a7'
  }
}

export const createDocuSignEnvelope = async (event, data) => {
  const request = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  const { employeePublicKey, returnUrl } = request

  // TODO: VALIDATION of USERS' AUTHORIZATION!
  // const { authorizer } = event.requestContext
  // const { claims } = authorizer

  // TODO: USE `EmployeePublicKey` BELOW
  const {
    // cart,
    // family,
    // healthBundle,
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
  }, getDocuSignTemplateId(`${data.healthBundle.hios}`), getDocuSignCustomFieldData(data))

  body.emailSubject = 'DocuSign API call - Request Signature'
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
    enrollmentPublicKey, // I believe this is the same as employeePublicKey
    envelopeId,
    returnUrl,
  } = request

  const employeePublicKey = enrollmentPublicKey
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

  const email = `${data.primary && data.primary.HixmeEmailAlias}`
  const userName = `${data.primary && data.primary.FirstName} ${data.primary && data.primary.LastName}`

  const clientUserId = event.isOffline ? '123' : employeePublicKey
  const recipientId = '1'

  const payload = {
    params: {
      envelopeId,
    },
    body: JSON.stringify({
      ...request,
      returnUrl,
      authenticationMethod: 'email',
      clientUserId,
      email,
      recipientId,
      userName,
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
