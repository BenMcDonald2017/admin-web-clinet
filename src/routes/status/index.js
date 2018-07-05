import moment from 'moment'
import ware from 'warewolf'

import {
  EFFECTIVE_DATE,
  effectiveAge,
  getCart,
  getFamily,
  getHealthBundle,
  getPrimarySigner,
  saveCart,
} from '../../resources'
import { createDocuSignEnvelope } from '../../controllers'
import { before, after, queryStringIsTrue } from '../../utils'

export const getCartWithApplicationStatus = ware(
  before,

  async (event) => {
    const result = {
      cart: null,
      family: null,
      healthBundle: null,
      primary: null,
    }

    const { employeePublicKey } = event.params

    // TODO: validate incoming `employeePublicKey`
    // if (!employeePublicKey) {
    //   return
    // }

    const [theFamily, { Item: theCart }] = await Promise.all([
      getFamily(employeePublicKey),
      getCart(employeePublicKey),
    ])

    result.family = theFamily
    result.cart = theCart
    if (result.cart) {
      result.healthBundle = getHealthBundle(result.cart.Cart)
    }

    // check if worker has `healthBundle`
    if (!result.healthBundle) {
      console.warn(`${'*'.repeat(10)}  Health Bundle: NOT FOUND`)

      // set result to cart
      const { Cart: cart = {} } = result.cart || {}
      event.result = cart
      event.workerHasNoHealthBundle = true
      return
    }

    // check if missing `cart` or `family`
    if (!result.cart || !result.family) {
      console.warn(`${'*'.repeat(10)}  Missing Cart and/or Family!`)
    }

    if (event.workerHasNoHealthBundle) {
      return
    }
    // now that we have everything, let's get the primary signer/applicant
    result.primary = getPrimarySigner(result.healthBundle, result.family)

    if (event.workerHasNoHealthBundle) {
      return
    }

    // result.healthBundle.Benefits           ... is an array of benefits
    // result.healthBundle.NotIncluded        ... is an array of people

    // save new 'healthBundle' to the cart!
    result.cart.Cart = await Promise.all(result.cart.Cart.map(async (product) => {
      if (product.BenefitType === 'HealthBundle') {
        return createEnvelopes(
          result.healthBundle,
          result.primary,
          result.family,
          event,
        )
      }

      return product
    }))

    // save cart
    await saveCart(result.cart)

    // return results
    event.result = result.cart.Cart
  },

  after,
)

const createEnvelopes = async (healthBundle, primary, family, event) => {
  // 1. iterate through health insurance benefits and create docusign envelopes for each
  healthBundle.Benefits = await Promise.all(healthBundle.Benefits.map(async (benefit) => {
    const { queryStringParameters: { force = false } = {} } = event
    const forceFlagIsSet = queryStringIsTrue(force)

    // here, we're figuring out whether or not we should regenerate DocuSign envelopes
    const mostRelevantDateToConsider = benefit.DocuSignEnvelopeCreatedOn
      ? benefit.DocuSignEnvelopeCreatedOn
      : benefit.UpdatedDate
    const docsCreatedDuringDocuSignIssues = moment(mostRelevantDateToConsider).isBefore('2017-12-05T17')
    const docsAreAlreadySigned = benefit.EnvelopeComplete === true
    const allSignersHaveSigned = (benefit.PdfSignatures || []).every(sig => sig.Signed === true)
    const shouldGenerateNewDocuSignEnvelope =
        docsCreatedDuringDocuSignIssues &&
        !docsAreAlreadySigned &&
        !allSignersHaveSigned

    // GENERATE NEW DOCS WHEN:
    // 1). The Cart's HealthBundle item has no `DocuSignEnvelopeId`;
    // 2). We determine that the user should have new docs generated (above); or,
    // 3). If requestor sets `force` flag in the URL to `true`
    if (
      !benefit.DocuSignEnvelopeId ||
        shouldGenerateNewDocuSignEnvelope ||
        forceFlagIsSet
    ) {
      let signers = benefit.Persons.filter(person =>
        /^included$/i.test(person.BenefitStatus))
      // filter out signers that are under 18
      const under18Ids = family
        .filter(person =>
          effectiveAge(`${person.DateOfBirth}`, `${EFFECTIVE_DATE}`) < 18)
        .map(minorChild => minorChild.Id)
      signers = signers.filter(signer => !under18Ids.includes(signer.Id))

      if (
        benefit.Persons.every(person => /child/i.test(person.Relationship))
      ) {
        // if benefit has only children deps then add primary to signers list
        signers = [primary, ...signers]
        if (
          benefit.Persons.every(person => !under18Ids.includes(person.Id))
        ) {
          // if benefit have only dependents, and none of those dependents are under 18, then remove the worker from the signatures list—they don't need to sign
          signers = signers.filter(signer => signer.Id !== `${primary.Id}`)
        }
      }

      // this puppy kicks off all the docusign creation code
      await createDocuSignEnvelope(benefit, primary, family, signers, event)
      // destructures 'event.envelope.envelopeId' and sets defaults, if empty
      const { envelope: { envelopeId = 'undefined' } = {} } = event
      const currentDateTime = new Date().toISOString()

      benefit = {
        ...benefit,
        AllApplicationsAvailable: true,
        // DocuSignEnvelopeCompletedOn: 'undefined',
        DocuSignEnvelopeCreatedOn: currentDateTime,
        DocuSignEnvelopeId: envelopeId,
        EnvelopeComplete: false,
        PdfApplicationAvailable: true,
        PdfSignatures: signers.map(signer => ({
          // multiple signers
          Id: signer.Id,
          Signed: false,
        })),
        UpdatedDate: currentDateTime,
      }
    }
    return benefit
  }))

  // 2. set results
  event.result = healthBundle

  // 3. return new healthBundle, w/ DocuSign docs created and the appropriate
  // 'ID's inserted into the requisite "healthBenefit" record(s)
  return healthBundle

  // 4. profit
}
