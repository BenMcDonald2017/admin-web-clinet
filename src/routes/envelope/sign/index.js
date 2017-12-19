import ware from 'warewolf'

import { before, after } from '../../../utils'
import { createDocuSignEmbeddedEnvelope, setDocuSignEnvelopeSigningStatus } from '../../../controllers'

// POST
export const createSigningSession = ware(
  before,
  createDocuSignEmbeddedEnvelope,
  after,
)

// GET (added to support the existing frontend routes and http-methods)
export const getApplicationSigningLink = ware(
  before,
  createDocuSignEmbeddedEnvelope,
  after,
)

// GET
export const saveSignatureStatus = ware(
  before,
  setDocuSignEnvelopeSigningStatus,
  after,
)
