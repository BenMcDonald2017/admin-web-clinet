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

const getTabsData = (fields = {}) => {
  const textTabs = map(fields, (value, tabLabel) => {
    tabLabel = `\\*${tabLabel}`
    // const valueLabel = /checkbox/i.test(tabLabel) ? 'selected' : 'value'
    const valueLabel = 'value'
    const data = {}
    data.tabLabel = tabLabel
    data[valueLabel] = formatted(value)
    data.locked = true

    return data
  })

  return {
    textTabs,
  }
}

// GET SIGNATURES
const signingRoles = ['Worker', 'Spouse', 'Dep1', 'Dep2', 'Dep3', 'Dep4', 'Dep5', 'Dep6']
const getSignatureRoles = signers => signers.map((signer, i) => ({
  roleName: `${signingRoles[i + 1]}`, // +1 so that we skip over choosing 'Worker'
  // ...signer,
  name: `${signer.name}`,
  email: `${signer.email}`.toLowerCase(),
  clientUserId: `${signer.clientUserId}`,
  recipientId: `${i + 2}`, // i = 0 at first; so we add 1; and then another 1, since 'Worker' is already id '1'
}))

const getTemplateJSON = ({
  fields, signers, templateId, userData,
}) => {
  const templateRoles = [{
    roleName: 'Worker',
    ...userData,
    tabs: getTabsData(fields),
  }]

  signers = signers.filter(signer => (signer.clientUserId !== userData.clientUserId))
  if (signers.length) { templateRoles.push(...getSignatureRoles(signers)) }

  return {
    templateId,
    templateRoles,
  }
}

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
  const clientUserId = `${employeePublicKey}`
  const email = `${worker.HixmeEmailAlias}`.toLowerCase()
  const name = [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
  const recipientId = '1'

  const { HealthPlanId = '' } = benefit
  const [template = {}] = await getDocuSignApplicationTemplate(HealthPlanId)
  const { TemplateId = null } = template

  const getTemplateId = () => {
    switch (process.env.STAGE) {
      case 'prod':
        return TemplateId || 'b9bcbb3e-ad06-480f-8639-02e3d5e6acfb'
      case 'int':
      case 'dev':
      default:
        return '0b1c81d0-703d-49bb-861a-c0e2509ba142'
    }
  }

  const fields = getDocuSignCustomFieldData({
    benefit, family, signers, worker,
  })
  const templateId = getTemplateId()
  const userData = {
    clientUserId, email, name, recipientId, returnUrl,
  }
  const body = getTemplateJSON({
    fields, signers, templateId, userData,
  })

  /* eslint-disable no-debugger */ debugger

  body.emailSubject = `Signature Request: ${name}`
  body.status = 'sent' // indicates to DS that this _isn't_ a draft
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
  const email = `${worker.HixmeEmailAlias}`.toLowerCase()
  const name = [worker.FirstName, worker.MiddleName, worker.LastName].filter(e => e && e != null).join(' ')
  // const email = 'mary.jonest/own@hixmeusers.com'
  // const name = 'Mary Jonestown'
  clientUserId = clientUserId || `${employeePublicKey}`
  recipientId = recipientId || '1'

  // https://www.docusign.com/p/RESTAPIGuide/RESTAPIGuide.htm#REST%20API%20References/Post%20Recipient%20View.htm

  const payload = {
    params: {
      envelopeId,
    },
    body: JSON.stringify({
      ...request,
      authenticationMethod: 'password',
      clientUserId,
      email,
      recipientId,
      returnUrl,
      userName: name, // notice that ww're passing 'userName'; not 'user'
    }),
  }

  event.result = await createEmbeddedEnvelope(payload)
}
