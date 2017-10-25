import ware from 'warewolf'

import { before, after } from '../../../utils'
import { createDocusignEmbeddedEnvelope } from '../../../controllers'
import { getPerson } from '../../../resources'

const fetchPerson = ware(async (event) => {
  event.person = await getPerson(event.body.personPublicKey)
})

// create signing session
export const createSigningSession = ware(
  before,

  // fetch person object and set to 'event.person'
  fetchPerson,

  async (event) => {
    await createDocusignEmbeddedEnvelope(event)
  },

  after,
)
