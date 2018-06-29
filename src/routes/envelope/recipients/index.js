import ware from 'warewolf'
import { before, after } from '../../../utils'
import { getEnvelopeSigners } from '../../../controllers'

export const onGetEnvelopeSigners = ware(
  before,
  getEnvelopeSigners,
  after,
)
