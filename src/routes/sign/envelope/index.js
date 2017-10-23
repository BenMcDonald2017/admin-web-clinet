import ware from 'warewolf'
import { before, after } from '../../../utils'
import { getPerson } from '../../../resources'
import { getDocuSignEnvelopeController } from '../../../controllers'

const fetchPerson = ware(async (event) => {
  event.person = await getPerson(event.body.personPublicKey)
})

export const createEnvelope = ware(
  before,

  // fetch person object and set to 'event.person'
  fetchPerson,

  // create everything in DS and set embedded DS-link to 'event.result.url'
  async (event) => {
    await getDocuSignEnvelopeController(event)
  },

  after,
)
