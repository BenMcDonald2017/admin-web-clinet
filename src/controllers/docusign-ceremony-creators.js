/* eslint-disable no-param-reassign */
import { map } from 'lodash'

import { createEnvelope, getEnvelopes, createEmbeddedEnvelope } from './docusign-api'

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
  switch (healthPlanId) {
    case '123':
    case '456':
    case '789':
      return '99999999-9999-9999-9999-999999999999'
    default: // default INT template if none are found above
      return 'd002f6f3-b944-43c5-9456-9461eceb5765'
      // return '96dc44bf-1199-4841-a3d1-e6568238aab5'  // previous one in int
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
    cart,
    family,
    healthBundle,
    primary,
  } = data

  const clientUserId = event.isOffline ? '123' : employeePublicKey
  const email = primary.HixmeEmailAlias
  const name = `${primary.FirstName} ${primary.LastName}`
  const recipientId = '1'

  const body = getTemplateJSON({
    clientUserId,
    email,
    name,
    recipientId,
    returnUrl,
  }, getDocuSignTemplateId(), {
    // carrier_name: `${cart.planName}`,
    // name_first: `${primary.first_name}`,
    // name_last: `${primary.last_name}`,
    // name_full: `${primary.first_name} ${primary.last_name}`,
    // plan_name: `${healthBundle.name}`,
    // plan_hios_id: `${healthBundle.hios}`,
    // gender: `${primary.gender}`,
  })

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

  // TODO:
  // Save `envelopeId` and `clientUserId` to Enrollment or Cart or something else
}

export const createDocuSignEmbeddedEnvelope = async (event) => {
  const data = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  // const { authorizer } = event.requestContext
  // const { claims } = authorizer
  const {
    email,
    enrollmentPublicKey,
    envelopeId,
    userName,
  } = data
  const clientUserId = event.isOffline ? '123' : enrollmentPublicKey
  const recipientId = '1'

  const payload = {
    params: {
      envelopeId,
    },
    body: JSON.stringify({
      ...data,
      authenticationMethod: 'email',
      clientUserId,
      email,
      recipientId,
      userName,
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
