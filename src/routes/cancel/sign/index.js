// import moment from 'moment'
import { get } from 'delver'
import ware from 'warewolf'
import { before, after } from '../../../utils'
import {
  getFamily,
  getPreviousYearPlan,
  getPrimarySigner,
} from '../../../resources'
import { createEmbeddedEnvelope } from '../../../controllers'


export const getCancelationSigningLink = ware(
  before,

  async (event) => {
    const request = {
      ...(event.body || {}),
      ...(event.params || {}),
    }
    const {
      employeePublicKey,
      envelopeId,
      returnUrl,
      userId,
    } = request

    // event.currentPlan = await getCurrentYearPlan(event.employeePublicKey)
    event.previousPlan = await getPreviousYearPlan(employeePublicKey)

    // event.currentPlan = (event.currentPlan && event.currentPlan.length) ? event.currentPlan[0] : event.currentPlan
    event.previousPlan = (event.previousPlan && event.previousPlan.length) ? event.previousPlan[0] : event.previousPlan


    event.family = await getFamily(employeePublicKey)
    event.primary = getPrimarySigner(event.previousPlan, event.family)
    const signer = event.primary
    const id = userId || employeePublicKey

    const payload = {
      params: {
        envelopeId,
      },
      body: JSON.stringify({
        authenticationMethod: 'password',
        clientUserId: `${id}`,
        /* eslint-disable no-nested-ternary */
        email: `${signer.email ? signer.email : signer.HixmeEmailAlias ? signer.HixmeEmailAlias : `${(signer.FirstName).replace(/\./g, '')}.${(signer.LastName).replace(/\./g, '')}@hixmeusers.com`}`.replace(/\s+/g, '').toLowerCase(),
        // recipientId: '1', // number?
        returnUrl: `${returnUrl}`,
        userName: `${signer.name ? signer.name : [signer.FirstName, signer.LastName].filter(e => e && e != null).join(' ')}`,
        userId: id || undefined,
      }),
    }

    event.result = await createEmbeddedEnvelope(payload)
  },

  after,
)