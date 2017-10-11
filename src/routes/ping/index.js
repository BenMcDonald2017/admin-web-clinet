import ware from 'warewolf';
import { before, after, queryStringIsTrue } from '../../utils';

export const pong = ware(

// debugger;

  before,

  async (event) => {
    const message = 'pong!';
    const nodeVersion = process.versions.node;

    event.result = {
      message,
      'node version': nodeVersion,
    };

    // if `showEvent` qs-param is true...
    if (queryStringIsTrue(event.query.showEvent)) {
      event.result.event = { ...event };
    }
  },

  after,
);
