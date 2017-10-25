import ware from 'warewolf'
import { before, after, queryStringIsTrue } from '../../utils'

export const ping = ware(
  before,

  async (event) => {
    event.result = {
      message: 'pong!',
      versions: {
        node: process.versions.node,
        app: process.env.VERSION,
      },
    }

    // if `showEvent` qs-param is true...
    if (queryStringIsTrue(event.params.showEvent)) {
      event.result.event = { ...event }
    }
  },

  after,
)
