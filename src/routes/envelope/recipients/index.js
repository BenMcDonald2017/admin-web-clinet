import ware from 'warewolf'
import { before, after } from '../../../utils'
import { getEnvelopeRecipients } from '../../../controllers'

export const doGetEnvelopeRecipients = ware(
  before,
  getEnvelopeRecipients,
  after,
)
