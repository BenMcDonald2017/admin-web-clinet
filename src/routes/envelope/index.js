import ware from 'warewolf';
import { before, after } from '../../utils';
import { getPerson } from '../../resources';

const fetchPerson = ware(
  before,

  async (event) => {
    const { personPublicKey } = event.body;
    event.result = await getPerson(personPublicKey);
  },

  after,
);

// CREATE ENVELOPE
export const create = ware(
  before,

  fetchPerson,

  // async (event) => {
  //   event.result = { created: true };
  // },

  after,
);
