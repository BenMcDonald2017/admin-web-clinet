import ware from 'warewolf'
import { before, after } from '../../../utils'
// import { getEnvelopeRecipients } from '../../../controllers'

export const onGetEnvelopeRecipients = ware(
  before,

  async (event) => {
    event.result = {
      status: 'endpoint is not fully implemented',
    }
  },

  after,
)
