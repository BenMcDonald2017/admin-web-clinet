/* eslint-disable no-param-reassign */
import { map, isEmpty } from 'lodash';
import uuid from 'uuid/v4';
import {
  // getDocusignAuth,
  createEnvelope,
  createEmbeddedEnvelope,
} from './docusign-api';

const { STAGE = 'dev' } = process.env;

const getTemplateJson = (user, fields) => ({
  templateId: STAGE === 'prod' // 'Please DocuSign: Your Hixme Provider HIPAA Form'
    ? '6550a3df-8a4d-488e-9ae6-e33ed468d815' // 'hipaa-hixme' in PROD (services@hixme.com)
    : 'aca6a120-69f5-4f16-9c02-c32cb8abdfe4', // 'hipaa-hixme' in DEV (docusign@hixme.com)
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
});

export const getHipaaDocusignBundleActivationCeremonyController =
  async (event) => {
    const {
      requestId,
      authorizer,
    } = event.requestContext;
    const {
      claims,
    } = authorizer;
    const recipientId = '1';
    const params = {
      ...(event.body || {}),
      ...(event.query || {}),
    };
    const {
      userName: name,
      email,
      bundleEventId,
    } = params;
    const required = [name, email, bundleEventId];
    if (required.some(isEmpty)) {
      const err = new Error(`Missing required parameter ${required.filter(isEmpty).join(', ')}.`);
      err.statusCode = 400;
      throw err;
    }
    const clientUserId = requestId || claims['cognito:username'] || uuid();
    const body = getTemplateJson({
      email,
      name,
      recipientId,
      clientUserId,
    }, {
    });
    body.emailSubject = 'DocuSign API call - Request Signature';
    // comment this out if you want to make it a draft and add docs
    body.status = 'sent';
    body.fromDate = new Date();

    const envelope = await createEnvelope({ body: JSON.stringify(body) });
    const { envelopeId } = envelope;

    const { Models } = event;
    const bundleEvent = await Models.BundleEvent.get(bundleEventId);
    if (!bundleEvent) {
      const err = new Error(`Bundle Event ${bundleEventId} not found.`);
      err.statusCode = 404;
      throw err;
    }
    bundleEvent.DocusignEnvelopes = bundleEvent.DocusignEnvelopes || [];
    bundleEvent.DocusignEnvelopes.push({ envelopeId });
    await bundleEvent.save();

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
    });
  };
