import moment from 'moment'
import ware from 'warewolf'

import {
  EFFECTIVE_DATE,
  effectiveAge,
  getCart,
  getFamily,
  getHealthBundle,
  getPrimarySigner,
  getSigners,
  saveCart,
} from '../../resources'
import { createDocuSignEnvelope } from '../../controllers'
import { before, after, queryStringIsTrue } from '../../utils'

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
      const { Cart: cart = {} } = data.cart || {}
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

const createEnvelopes = async (healthIns, primary, family, event) => {
  // iterate through health insurance benefits and create docusign envelopes for each
  healthIns.Benefits = await Promise.all(healthIns.Benefits.map(async (benefit) => {
    const { queryStringParameters: { force = false } = {} } = event
    const forceFlagIsSet = queryStringIsTrue(force)

    // here, we're figuring out whether or not we should regenerate DocuSign envelopes
    const mostRelevantDateToConsider = benefit.DocuSignEnvelopeCreatedOn ? benefit.DocuSignEnvelopeCreatedOn : benefit.UpdatedDate
    const docsCreatedDuringDocuSignIssues = moment(mostRelevantDateToConsider).isBefore('2017-12-05T17')
    const docsAreAlreadySigned = benefit.EnvelopeComplete === true
    const allSignersHaveSigned = (benefit.PdfSignatures || []).every(sig => sig.Signed === true)
    const shouldGenerateNewDocuSignEnvelope = (docsCreatedDuringDocuSignIssues && !docsAreAlreadySigned && !allSignersHaveSigned)

    // GENERATE NEW DOCS WHEN:
    // 1). The Cart's HealthBundle item has no `DocuSignEnvelopeId`;
    // 2). We determine that the user should have new docs generated (above); or,
    // 3). If requestor sets `force` flag in the URL to `true`
    if (!benefit.DocuSignEnvelopeId || shouldGenerateNewDocuSignEnvelope || forceFlagIsSet) {
      let signers = benefit.Persons.filter(person => /^included$/i.test(person.BenefitStatus))
      // filter out signers that are under 18
      const under18Ids = family.filter(person => effectiveAge(`${person.DateOfBirth}`, `${EFFECTIVE_DATE}`) < 18).map(minorChild => minorChild.Id)
      signers = signers.filter(signer => !under18Ids.includes(signer.Id))

      if (benefit.Persons.every(person => /child/i.test(person.Relationship))) {
        // if benefit has only children deps then add primary to signers list
        signers = [primary, ...signers]
        if (benefit.Persons.every(person => !under18Ids.includes(person.Id))) {
          // if benefit have only dependents, and none of those dependents are under 18, then remove the worker from the signatures list—they don't need to sign
          signers = signers.filter(signer => signer.Id !== `${primary.Id}`)
        }
      }

      // this puppy kicks off all the docusign creation code
      await createDocuSignEnvelope(benefit, primary, family, signers, event)

      // destructuring 'event.envelope.envelopeId' and setting defaults if none
      const { envelope: { envelopeId = '' } = {} } = event

      const currentDateTime = new Date().toISOString()

      benefit = {
        ...benefit,
        // DocuSignEnvelopeCompletedOn: ' ',
        DocuSignEnvelopeCreatedOn: currentDateTime,
        DocuSignEnvelopeId: envelopeId,
        EnvelopeComplete: false,
        UpdatedDate: currentDateTime,
      }

      // handle multiple signatures
      benefit.PdfSignatures = signers.map(signer => ({
        Id: signer.Id,
        Signed: false,
      }))
    }
    return benefit
  }))
  return healthIns
}
