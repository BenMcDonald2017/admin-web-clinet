import { isEmpty } from 'lodash'
import { getEnvelopes, getRootUrl, fetchDocuSignURL } from './docusign-api'

export const getEnvelopesForBundleEventController = async (event) => {
  const bundleEvent = await event.Models.BundleEvent.get(event.query.bundleEventId)
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

export const getDocumentsForBundleEventController = async (event) => {
  await getEnvelopesForBundleEventController(event)
  const { result } = event
  const { envelopes } = result

  event.result = await Promise.all(envelopes.map(async (envelope) => {
    let documents = await fetchDocuSignURL(envelope.documentsUri)
    documents = await Promise.all(documents.envelopeDocuments.map(async (document) => {
      const payload = await fetchDocuSignURL(document.uri, { format: 'base64' })
      return Object.assign({}, document, { payload })
    }))
    return Object.assign(envelope, { documents })
  }))
}
