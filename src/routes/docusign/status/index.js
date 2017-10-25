import ware from 'warewolf'

import { before, after } from '../../../utils'
import { /* getEnvelope, */ getEnvelopes } from '../../../controllers'

export const getEnvelopeStatus = ware(
  before,

  async (event) => {
    const { envelopeId } = event.params
    event.envelopeId = envelopeId
  },

  async (event) => {
    if (!event.envelopeId) return

    event.result = await getEnvelopes({
      query: {
        envelope_ids: `${event.envelopeId}`,
      },
    })
  },

  async (event) => {
    event.result.exists = !!(event.result.envelopes && event.result.envelopes.length)
  },

  after,
)
