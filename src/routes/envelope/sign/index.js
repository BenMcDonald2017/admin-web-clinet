import ware from 'warewolf'

import { before, after } from '../../../utils'
import { createDocuSignEmbeddedEnvelope } from '../../../controllers'
// import { getPerson } from '../../../resources'

// POST create signing session
export const createSigningSession = ware(
  before,

  async (event) => {
    await createDocuSignEmbeddedEnvelope(event)
  },

  after,
)


// GET create signing session
export const getApplicationSigningLink = ware(
  before,

  async (event) => {
    await createDocuSignEmbeddedEnvelope(event)
  },

  after,
)
