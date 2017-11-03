import ware from 'warewolf'

import { before, after } from '../../../utils'
import { createDocuSignEmbeddedEnvelope } from '../../../controllers'
// import { getPerson } from '../../../resources'

// create signing session
export const createSigningSession = ware(
  before,

  // async (event) => {
  //   event.person = await getPerson(event.body && (event.body.personPublicKey || event.body.employeePublicKey))
  // },

  async (event) => {
    await createDocuSignEmbeddedEnvelope(event)
  },

  // async (event) => {
  //   const examplePATCHtoEnrollmentService = {
  //     pathParameters: {
  //       EnrollmentPublicKey: '10908a4c-5ca8-4c69-82a1-788fd6416239',
  //     },
  //     body: {
  //       Signatures: [{
  //         BundlePublicKey: 'b041a93e-7a1c-46cc-aaf4-e0ef7877f418',
  //         DocuSignEnvelopeId: '785b91c7-756b-443e-8971-65d20e0ebaee',
  //       }],
  //     },
  //     requestContext: {
  //       authorizer: {
  //         claims: {
  //           'custom:user-role': 'PlatformEmployee',
  //           'cognito:username': 'b6c4e54b-66a6-4807-8436-bfab0ace2b60',
  //           email: 'c.bumstead@hixme.com',
  //         },
  //       },
  //     },
  //   }

  //   console.dir(examplePATCHtoEnrollmentService)
  // },

  // async (event) => {
  //   // save user's `envelopeId` into their Enrollment Bundle
  //   console.log(event.result && event.result.envelopeId)
  //   console.log(event.result && event.result.clientUserId)
  // },

  after,
)
