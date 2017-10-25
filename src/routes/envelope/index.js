import ware from 'warewolf'
import { before, after } from '../../utils'
import { getPerson } from '../../resources'
import { createDocuSignEnvelope, getDocuSignEnvelope } from '../../controllers'

const fetchPerson = ware(async (event) => {
  event.person = await getPerson(event.body.personPublicKey)
})

export const createEnvelope = ware(
  before,

  // fetch person object and set to 'event.person'
  fetchPerson,

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
