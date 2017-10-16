import ware from 'warewolf';
import { before, after } from '../../utils';
import { getPerson } from '../../resources';

// CREATE ENVELOPE
export const create = ware(
  before,

  async (event) => {
    event.result = { created: true };
  },

  after,
);


export const fetchPerson = ware(
  before,

  async (event) => {
    const { personPublicKey } = event.body;
    event.result = await getPerson(personPublicKey);
  },

  after,
);
