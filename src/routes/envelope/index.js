import ware from 'warewolf'
import { before, after } from '../../utils'
import { createDocuSignEnvelope, getDocuSignEnvelope } from '../../controllers'

export const createEnvelope = ware(
  before,

  async (event) => {
    if (!event.body.enrollmentPublicKey || event.body.enrollmentPublicKey == null ||
        !event.body.returnUrl || event.body.returnUrl == null) {
      const error = new Error('Missing one or more required parameters')
      error.statusCode = 400
      throw error
    }
  },

  async (event) => {
    await createDocuSignEnvelope(event)
  },

  after,
)

export const getEnvelope = ware(
  before,

  async (event) => {
    await getDocuSignEnvelope(event)
  },

  after,
)
