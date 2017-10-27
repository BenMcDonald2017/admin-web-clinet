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
      return '96dc44bf-1199-4841-a3d1-e6568238aab5'
  }
}

export const createDocuSignEnvelope = async (event) => {
  const data = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  // const { authorizer } = event.requestContext
  // const { claims } = authorizer
  const { enrollmentPublicKey, returnUrl } = data

  // TODO:
  // using `enrollmentPublicKey`, we need to fetch the following:
  // (1) user's email
  // (2) user's first/last name
  // (3) user's health plan ID (or whatever is needed to match healthplans to docusign templates)

  const clientUserId = event.isOffline ? '123-456' : enrollmentPublicKey
  const email = 'john@smith.com'
  const name = 'John Smith'
  const recipientId = '1'

  const body = getTemplateJSON({
    clientUserId,
    email,
    name,
    recipientId,
    returnUrl,
  }, getDocuSignTemplateId(), { /* other form fields here */ })

  body.emailSubject = 'DocuSign API call - Request Signature'
  body.status = 'sent' // indicates to DS that this _isn't_ a draft
  body.fromDate = new Date()

  console.dir(body)

  const envelope = await createEnvelope({ body: JSON.stringify(body) })
  const { envelopeId } = envelope

  event.result = {
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
  const { enrollmentPublicKey, envelopeId } = data
  const clientUserId = event.isOffline ? '123-456' : enrollmentPublicKey

  // TODO:
  // using `enrollmentPublicKey`, we need to fetch the following:
  // (1) user's email
  // (2) user's first/last name

  const email = 'john@smith.com'
  // NOTE: they need `userName` — not `name`
  const userName = 'John Smith'
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
