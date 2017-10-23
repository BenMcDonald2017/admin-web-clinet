import ware from 'warewolf'
import { before, after, queryStringIsTrue } from '../../utils'

export const ping = ware(
  before,

  async (event) => {
    event.result = {
      message: 'pong!',
      version: process.versions.node,
    }

    // if `showEvent` qs-param is true...
    if (queryStringIsTrue(event.query.showEvent)) {
      event.result.event = { ...event }
    }
  },

  after,
)
