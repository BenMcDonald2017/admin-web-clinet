import { isEmpty } from 'lodash'
import { getEnvelopes, getRootUrl, fetchDocuSignURL, getEnvelopeRecipients } from './docusign-api'

export const getEnvelopesForBundleEventController = async (event) => {
  const bundleEvent = await event.Models.BundleEvent.get(event.params.bundleEventId)
  if (!bundleEvent || isEmpty(bundleEvent.DocusignEnvelopes)) {
    return
  }
  const { DocusignEnvelopes = [] } = bundleEvent
  event.result = await getEnvelopes({
    query: {
      envelope_ids: DocusignEnvelopes.map(({ envelopeId }) => envelopeId).join(','),
    },
  })
  event.result.rootUrl = getRootUrl()
}

export const getEnvelopeSigners = async (event) => {
  const { params: { envelopeId = '' } = {} } = event
  const allEnvelopeData = await getEnvelopeRecipients({
    params: { envelopeId },
    query: { include_tabs: false },
  })
  const { signers = [] } = allEnvelopeData

  event.result = signers
  return signers
}

export const getDocumentsForBundleEventController = async (event) => {
  await getEnvelopesForBundleEventController(event)
  const { result: { envelopes = [] } = {} } = event

  event.result = await Promise.all(envelopes.map(async (envelope) => {
    let documents = await fetchDocuSignURL(envelope.documentsUri)
    documents = await Promise.all(documents.envelopeDocuments.map(async (document) => {
      const payload = await fetchDocuSignURL(document.uri, { format: 'base64' })
      return Object.assign({}, document, { payload })
    }))
    return Object.assign(envelope, { documents })
  }))
}
