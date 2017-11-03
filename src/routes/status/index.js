import { isObject } from 'lodash'
import AWS from 'aws-sdk'
import moment from 'moment'
import ware from 'warewolf'

import { before, after } from '../../utils'
import { createDocuSignEnvelope } from '../../controllers'

const {
  STAGE: stage,
  EFFECTIVE_DATE = '20170101',
  HEALTH_BUNDLE = 'HealthBundle',
} = process.env

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })
const lambda = new AWS.Lambda({ region: 'us-west-2' })

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
      event.result = data.cart && data.cart.Cart
      return
    }

    // check if missing `cart` or `family`
    if (!data.cart || !data.family) {
      console.warn(`${'*'.repeat(10)}  Missing Cart and/or Family!`)
    }
  },

  async () => {
    // now that we have everything, let's get the primary signer/applicant
    data.primary = getPrimarySigner(data.healthBundle, data.family)
  },

  async (event) => {
    // set everything to `true`, in order to match legacy payload
    data.healthBundle.Benefits.map((benefit) => {
      benefit.PdfApplicationAvailable = true
      return benefit
    })
    data.healthBundle.AllApplicationsAvailable = true
  },

  async (event) => {
    // PdfApplicationIsManual, PdfSignatures, UnsignedPdfApplication, DocuSignEnvelopeId
    data.healthBundle = await createEnvelopes(data.healthBundle, data.primary, data.family, event)

    data.cart.Cart = data.cart.Cart.map((product) => {
      if (product.BenefitType === HEALTH_BUNDLE) {
        return data.healthBundle
      }
      return product
    })

    await saveCart(data.cart)

    event.result = data.cart.Cart
  },

  after,
)

async function createEnvelopes(healthIns, primary, family, event) {
  healthIns.Benefits = await Promise.all(healthIns.Benefits.map(async (benefit) => {
    if (!benefit.DocuSignEnvelopeId && benefit.PdfApplicationAvailable === true) {
      const applicants = getApplicationPersons(benefit.Persons, primary, family)
      const signers = getSigners(applicants)

      benefit.EnvelopeComplete = false

      await createDocuSignEnvelope(event, data)

      benefit.DocumentLocation = 'DocuSign'
      benefit.UnsignedPdfApplication = 'DocuSign'
      benefit.DocuSignEnvelopeId = event.envelope.envelopeId
      benefit.PdfSignatures = signers.map(signer => ({
        Id: signer.clientUserId,
        Signed: false,
      }))
    }
    return benefit
  }))
  return healthIns
}

const forcePlain = arg => (Array.isArray(arg)
  ? arg.map(forcePlain)
  : (isObject(arg) ? Object.assign({}, arg) : arg))

function getSigners(family) {
  const signers = []
  const applicants = forcePlain(family)
  if (applicants.Primary && applicants.Guardian) {
    if (applicants.Primary.Relationship === 'Child') {
      const primary = applicants.Primary
      applicants.Children = applicants.Children || []
      applicants.Children.push(primary)
      delete applicants.Primary
    }
  }

  if (applicants.Primary) {
    signers.push(getSignerObject({
      email: applicants.Primary.HixmeEmailAlias,
      first: applicants.Primary.FirstName,
      last: applicants.Primary.LastName,
      id: applicants.Primary.Id,
      firstAnchor: 'PrimaryGuardian_Hixme_1',
      secondAnchor: 'PrimaryGuardian_Hixme_2',
      thirdAnchor: 'PrimaryGuardian_Hixme_3',
    }))
  }

  if (applicants.Guardian) {
    signers.push(getSignerObject({
      email: applicants.Guardian.HixmeEmailAlias,
      first: applicants.Guardian.FirstName,
      last: applicants.Guardian.LastName,
      id: applicants.Guardian.Id,
      firstAnchor: 'PrimaryGuardian_Hixme_1',
      secondAnchor: 'PrimaryGuardian_Hixme_2',
      thirdAnchor: 'PrimaryGuardian_Hixme_3',
    }))
  }

  if (applicants.Spouse) {
    const email = applicants.Spouse.HixmeEmailAlias ||
      (`${applicants.Spouse.FirstName}.${applicants.Spouse.LastName}@hixmeusers.com`)
    signers.push(getSignerObject({
      email,
      first: applicants.Spouse.FirstName,
      last: applicants.Spouse.LastName,
      id: applicants.Spouse.Id,
      firstAnchor: 'Spouse_Hixme_1',
      secondAnchor: 'Spouse_Hixme_2',
      thirdAnchor: 'Spouse_Hixme_3',
    }))
  }

  if (applicants.Children && applicants.Children.length > 0) {
    const kids = applicants.Children.filter(kid => effectiveAge(kid.DateOfBirth, EFFECTIVE_DATE) >= 18)

    for (let i = 0; i < kids.length; i++) {
      const email = kids[i].HixmeEmailAlias ||
        (`${kids[i].FirstName}.${kids[i].LastName}@hixmeusers.com`)
      signers.push(getSignerObject({
        email,
        first: kids[i].FirstName,
        last: kids[i].LastName,
        id: kids[i].Id,
        firstAnchor: `Dependent${i + 1}_Hixme_1`,
        secondAnchor: `Dependent${i + 1}_Hixme_2`,
        thirdAnchor: `Dependent${i + 1}_Hixme_3`,
      }))
    }
  }

  return signers
}

function getSignerObject(params) {
  return {
    email: params.email,
    name: `${params.first} ${params.last}`,
    clientUserId: params.id,
    recipientId: params.id,
    tabs: {
      signHereTabs: [
        {
          recipientId: params.id,
          anchorString: params.firstAnchor,
          anchorIgnoreIfNotPresent: true,
        },
        {
          recipientId: params.id,
          anchorString: params.secondAnchor,
          anchorIgnoreIfNotPresent: true,
        },
        {
          recipientId: params.id,
          anchorString: params.thirdAnchor,
          anchorIgnoreIfNotPresent: true,
        },
      ],
    },
  }
}

function getApplicationPersons(persons, primary, family) {
  const signerMap = {}
  const applicants = persons.map(person =>
    family.find(member => person.Id === member.Id))

  const children = applicants.filter(person =>
    person && person.Relationship === 'Child')

  if (children.Length > 1) {
    children.sort((a, b) => +b.DateOfBirth - a.DateOfBirth)
  }

  signerMap.Primary = applicants.find(member => member && member.Relationship === 'Employee')

  if (!signerMap.Primary) {
    signerMap.Primary =
      applicants.find(member => member && member.Relationship === 'Spouse')
  } else {
    const spouse = applicants.find(member => member.Relationship === 'Spouse')
    if (spouse) {
      signerMap.Spouse = spouse
    }
  }
  if (!signerMap.Primary) {
    signerMap.Guardian = primary
    signerMap.Primary = children.pop()
  }
  if (children.length) {
    signerMap.Children = children
  }
  return signerMap
}

function getPrimarySigner(healthIns = {}, family = []) {
  const primarySignerID = healthIns.EmployeePublicKey
  return family
    .find(person => person.Id === primarySignerID)
}

function getHealthBundle(cart) {
  return cart.find(benefit => benefit.BenefitType === HEALTH_BUNDLE)
}

async function getCart(EmployeePublicKey, TableName = `${stage}-cart`) {
  return docClient.get({
    TableName,
    Key: { EmployeePublicKey },
  }).promise()
}

async function saveCart(Item, TableName = `${stage}-cart`) {
  return docClient.put({
    TableName,
    Item,
  }).promise()
}

async function getFamily(employeePublicKey, TableName = `${stage}-persons`) {
  const { Items: family } = await docClient.query({
    TableName,
    IndexName: 'EmployeePublicKey-index',
    FilterExpression: 'IsActive = :isActive',
    KeyConditionExpression: 'EmployeePublicKey = :key',
    ExpressionAttributeValues: {
      ':key': employeePublicKey,
      ':isActive': true,
    },
  }).promise()

  return Promise.all(family.map(async (person) => {
    person.SSN = await getSSN(person.Id)
    return person
  }))
}

async function getSSN(personPublicKey) {
  const response = await lambda.invoke({
    FunctionName: `get-ssn:${stage}`,
    Payload: JSON.stringify({ PersonPublicKey: personPublicKey }, null, 2),
  }).promise()

  return JSON.parse(response.Payload).SSN
}

function effectiveAge(birthday, effectiveDate) { // birthday is a date
  return moment(effectiveDate, 'YYYYMMDD').diff(moment(birthday), 'years')
}
