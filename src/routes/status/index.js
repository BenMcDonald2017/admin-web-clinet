import ware from 'warewolf'
import { get } from 'delver'

import {
  getCart,
  saveCart,
  getFamily,
  getSigners,
  getApplicationPersons,
  getPrimarySigner,
  getHealthBundle,
} from '../../resources'
import { before, after, queryStringIsTrue } from '../../utils'
import { createDocuSignEnvelope } from '../../controllers'

const data = {
  cart: null,
  family: null,
  healthBundle: null,
  primary: null,
}

export const getCartWithApplicationStatus = ware(
  before,

  async (event) => {
    const { employeePublicKey } = event.params

    // TODO: validate incoming `employeePublicKey`
    // if (!employeePublicKey) {
    //   return
    // }

    const [theFamily, { Item: theCart }] = await Promise.all([
      getFamily(employeePublicKey),
      getCart(employeePublicKey),
    ])

    data.family = theFamily
    data.cart = theCart
    if (data.cart) {
      data.healthBundle = getHealthBundle(data.cart.Cart)
    }
  },

  async (event) => {
    // check if worker has `healthBundle`
    if (!data.healthBundle) {
      console.warn(`${'*'.repeat(10)}  Health Bundle: NOT FOUND`)

      // set result to cart
      const { Cart: cart } = data.cart
      event.result = cart
      event.workerHasNoHealthBundle = true
      return
    }

    // check if missing `cart` or `family`
    if (!data.cart || !data.family) {
      console.warn(`${'*'.repeat(10)}  Missing Cart and/or Family!`)
    }
  },

  async (event) => {
    if (event.workerHasNoHealthBundle) {
      return
    }
    // now that we have everything, let's get the primary signer/applicant
    data.primary = getPrimarySigner(data.healthBundle, data.family)
  },

  async (event) => {
    if (event.workerHasNoHealthBundle) {
      return
    }

    // data.healthBundle.Benefits           ... is an array of benefits
    // data.healthBundle.NotIncluded        ... is an array of people

    data.healthBundle = await createEnvelopes(data.healthBundle, data.primary, data.family, event)
    const { healthBundle: { Benefits = [] } = {} } = data

    Benefits.map((benefit) => {
      benefit.PdfApplicationAvailable = true
      return benefit
    })
    data.healthBundle.AllApplicationsAvailable = true

    data.cart.Cart = data.cart.Cart.map((product) => {
      if (product.BenefitType === 'HealthBundle') {
        return data.healthBundle
      }
      return product
    })

    await saveCart(data.cart)
    const { Cart: cart } = data.cart
    event.result = cart
  },

  after,
)

async function createEnvelopes(healthIns, primary, family, event) {
  // iterate through health insurance benefits and create docusign envelopes for each
  healthIns.Benefits = await Promise.all(healthIns.Benefits.map(async (benefit) => {
    const { queryStringParameters: { force = false } = {} } = event
    const forceFlagIsSet = queryStringIsTrue(force)

    // if the item in the cart has no docusignID or force flag is set, generate new one!
    if (!benefit.DocuSignEnvelopeId || forceFlagIsSet) {
      const coveredPeople = benefit.Persons.filter(b => b.BenefitStatus === 'Included')
      const applicants = getApplicationPersons(coveredPeople, primary, family)
      const signers = getSigners(applicants)

      benefit.EnvelopeComplete = false

      await createDocuSignEnvelope(benefit, primary, family, signers, event)

      benefit.DocumentLocation = 'DocuSign'
      benefit.UnsignedPdfApplication = 'DocuSign'
      benefit.DocuSignEnvelopeId = event.envelope && event.envelope.envelopeId

      // handle multiple signatures
      benefit.PdfSignatures = signers.map(signer => ({
        Id: signer.clientUserId,
        Signed: false,
      }))
    }
    return benefit
  }))
  return healthIns
}
