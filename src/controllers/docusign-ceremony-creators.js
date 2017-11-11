/* eslint-disable no-param-reassign */
import { map } from 'lodash'

import { createEnvelope, getEnvelopes, createEmbeddedEnvelope } from './docusign-api'
import { getDocuSignCustomFieldData } from '../controllers'
import {
  getApplicationPersons,
  getCart,
  getDocuSignApplicationTemplate,
  getFamily,
  getHealthBundle,
  getPrimarySigner,
  getSigners,
  saveCart,
} from '../resources'

const isBoolean = value => typeof value === typeof true
const isNumber = value => !!(value === 0 || (!Number.isNaN(value) && Number(value)))
const isSomething = value => isBoolean(value) || isNumber(value) || (value && value != null)
const revertToType = content => ((isBoolean(content) || isNumber(content)) ? content : `${content}`)
const formatted = content => (isSomething(content) ? revertToType(content) : ' ')

const getTemplateJSON = (user, templateId, fields) => ({
  templateId,
  templateRoles: [{
    roleName: 'Worker',
    ...user,
    tabs: {
      textTabs: map(fields, (value, tabLabel) => ({
        tabLabel: `\\*${tabLabel}`,
        value: formatted(value),
      })),
    },
  }],
})

const status = thing => text => !!thing.match(new RegExp(`^${text}$`, 'i'))
const isComplete = status('completed')

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

  const allEnvelopesAreSigned = (envelopesExist && envelopes.every(isComplete))
  event.result.completed = (envelopesExist && allEnvelopesAreSigned)
}

export const createDocuSignEnvelope = async (benefit, worker, family, signers, event) => {
  const request = {
    ...(event.body || {}),
    ...(event.params || {}),
  }
  // 'worker' is 'primary'
  const { employeePublicKey, returnUrl } = request
  const clientUserId = event.isOffline ? '123' : employeePublicKey
  const email = `${worker.HixmeEmailAlias}`.toLowerCase()
  const name = [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
  const recipientId = '1'

  const boilerplate = {
    clientUserId,
    email,
    name,
    recipientId,
    returnUrl,
  }

  const body = getTemplateJSON(
    boilerplate,
    // await getDocuSignApplicationTemplate(benefit.HealthPlanId),
    process.env.STAGE === 'prod' ? 'b9bcbb3e-ad06-480f-8639-02e3d5e6acfb' : 'a56ec5bc-5a0b-4d65-b225-dc81378f9650',
    getDocuSignCustomFieldData({
      benefit,
      family,
      signers,
      worker,
    }),
  )

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

  const { primary: worker } = data
  const clientUserId = event.isOffline ? '123' : employeePublicKey
  const email = `${worker.HixmeEmailAlias}`.toLowerCase()
  const name = [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
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
      // one must pass in 'userName'.  So silly.
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
