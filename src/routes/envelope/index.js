import ware from 'warewolf'
import { before, after } from '../../utils'
import { getPerson, saveDocuSignEnvelopeToEnrollment } from '../../resources'
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

  // async (event) => {
  //   event.person = await getPerson(event.body && (event.body.personPublicKey || event.body.employeePublicKey))
  // },

  async (event) => {
    await createDocuSignEnvelope(event)
  },

  // async (event) => {
  //   await saveDocuSignEnvelopeToEnrollment(event)
  // },

  after,
)

export const getEnvelope = ware(
  before,

  async (event) => {
    await getDocuSignEnvelope(event)
  },

  after,
)

// function isDocuSignEnvelopeCreated(event) {
//   return event && event.result && event.result.created
// }
