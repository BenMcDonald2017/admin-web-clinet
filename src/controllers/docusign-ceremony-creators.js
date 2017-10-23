/* eslint-disable no-param-reassign */
import { map, isEmpty } from 'lodash'
import uuid from 'uuid/v4'

import { createEnvelope, createEmbeddedEnvelope } from './docusign-api'

const getTemplateJson = (user, fields) => ({
  templateId: process.env.STAGE === 'prod' // '2018 Health Insurance Enrollment Application'
    // will need to create the forms in dev/int first and then copy them
    // over via DocuSign's built-in JSON copy feature thing
    ? '99999999-9999-9999-9999-999999999999' // PROD powerform
    : '96dc44bf-1199-4841-a3d1-e6568238aab5', // INT powerform
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

export const getDocuSignEnvelopeController =
  async (event) => {
    const {
      requestId,
      authorizer,
    } = event.requestContext
    const {
      claims,
    } = authorizer
    const recipientId = '1'

    const params = {
      ...(event.body || {}),
      ...(event.query || {}),
    }

    const {
      userName: name,
      email,
      bundleEventId,
      returnUrl,
    } = params

    const required = [name, email, bundleEventId, returnUrl]
    if (required.some(isEmpty)) {
      const err = new Error(`Missing required parameter ${required.filter(isEmpty).join(', ')}.`)
      err.statusCode = 400
      throw err
    }

    const clientUserId = event.isOffline ? uuid() : requestId || claims['cognito:username'] || uuid()

    const body = getTemplateJson({
      email,
      name,
      recipientId,
      clientUserId,
      returnUrl,
    }, { /* fields here */ })

    body.emailSubject = 'DocuSign API call - Request Signature'
    body.status = 'sent' // indicates to DS that this _isn't_ a draft
    body.fromDate = new Date()

    const envelope = await createEnvelope({ body: JSON.stringify(body) })
    const { envelopeId } = envelope

    // const { Models } = event
    // const bundleEvent = await Models.BundleEvent.get(bundleEventId)

    // if (!bundleEvent) {
    //   const err = new Error(`Bundle Event ${bundleEventId} not found.`)
    //   err.statusCode = 404
    //   throw err
    // }
    // bundleEvent.DocusignEnvelopes = bundleEvent.DocusignEnvelopes || []
    // bundleEvent.DocusignEnvelopes.push({ envelopeId })
    // await bundleEvent.save()

    event.result = await createEmbeddedEnvelope({
      params: {
        envelopeId,
      },
      body: JSON.stringify({
        ...params,
        clientUserId,
        recipientId,
        authenticationMethod: 'email',
      }),
    })
  }
