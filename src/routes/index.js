import { isObject } from 'lodash'
import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import moment from 'moment'
import ware from 'warewolf'

import { before, after } from '../utils'

export * from './envelope'
export * from './envelope/sign'
export * from './ping'

const {
  STAGE: stage,
  EFFECTIVE_DATE = '20170101',
  HEALTH_BUNDLE = 'HealthBundle',
} = process.env

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })
const lambda = new AWS.Lambda({ region: 'us-west-2' })
const s3 = new AWS.S3()

export const getCartWithApplicationStatus = ware(
  before,

  async (event) => {
    const data = {
      ...(event.body || {}),
      ...(event.params || {}),
    }

    const { employeePublicKey } = data
    const [family, { Item: cart }] = await Promise.all([
      getFamily(employeePublicKey),
      getCart(employeePublicKey),
    ])

    console.dir(family)
    console.dir(cart)

    let healthIns = getHealthIns(cart.Cart)

    if (!healthIns) {
      event.result = cart.Cart
      return
    }

    const primary = getPrimarySigner(healthIns, family)
    healthIns = await checkApplicationsAvailable(healthIns)

    healthIns = await createEnvelopes(healthIns, primary, family)

    cart.Cart = cart.Cart.map(product =>
      (product.BenefitType === HEALTH_BUNDLE ? healthIns : product))

    await saveCart(cart)

    event.result = cart.Cart
  },

  after,
)

async function createEnvelopes(healthIns, primary, family) {
  healthIns.Benefits = await Promise.all(healthIns.Benefits.map(async (benefit, i) => {
    if (!benefit.DocuSignEnvelopeId && benefit.PdfApplicationAvailable === true) {
      const hasTransmerica = benefit.hasTransmerica || true
      const applicants = getApplicationPersons(benefit.Persons, primary, family)
      let signers = getSigners(applicants)
      const documents = await getDocuments(benefit, applicants, primary, hasTransmerica)

      benefit.EnvelopeComplete = false
      if (benefit.HealthPlanId.substring(0, 7) === '10544CA' ||
        benefit.HealthPlanId.substring(0, 7) === '59763MA') {
        signers = []
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
      benefit.DocumentLocation = documents[0].documentLocation
      benefit.DocuSignEnvelopeId = await createEnvelope(applicants, signers, documents, primary, config)
      benefit.PdfSignatures = signers.map(signer => ({
        Id: signer.clientUserId,
        Signed: false,
      }))
    }

    if (benefit.DocumentLocation) {
      benefit.UnsignedPdfApplication = await s3.getSignedUrl('getObject', {
        Bucket: benefit.DocumentLocation.bucket,
        Key: benefit.DocumentLocation.key,
      })
    }
    return benefit
  }))
  return healthIns
}

async function createEnvelope(applicants, signers, documents, primary) {
  const body = {
    emailSubject: 'Health Insurance Application',
    emailBlurb: 'Read and sign please!',
    recipients: {
      signers,
    },
    documents,
    status: 'sent',
    textCustomFields: [{
      name: 'cartId',
      required: false,
      show: false,
      value: primary.Id,
    }],
  }
  const isProd = stage.toLowerCase() === 'prod' ? '_PROD' : ''
  const DOCUSIGN_ACCOUNT_ID = process.env[`DOCUSIGN_ACCOUNT_ID${isProd}`]
  const DOCUSIGN_BASE_URL = process.env[`DOCUSIGN_BASE_URL${isProd}`]
  const DOCUSIGN_IKEY = process.env[`DOCUSIGN_IKEY${isProd}`]
  const DOCUSIGN_PASSWORD = process.env[`DOCUSIGN_PASSWORD${isProd}`]
  const DOCUSIGN_USER_NAME = process.env[`DOCUSIGN_USER_NAME${isProd}`]


  const res = await fetch(`${DOCUSIGN_BASE_URL}/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-DocuSign-Authentication': JSON.stringify({
        Username: DOCUSIGN_USER_NAME,
        Password: DOCUSIGN_PASSWORD,
        IntegratorKey: DOCUSIGN_IKEY,
      }),
    },
    body: JSON.stringify(body),
  })

  const result = await res.json()

  return result.envelopeId
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
      if (!applicants.Children) applicants.Children = []
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
      (`${applicants.Spouse.FirstName}.${applicants.Spouse.FirstName}@hixmeusers.com`)
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
        (`${kids[i].FirstName}.${kids[i].FirstName}@hixmeusers.com`)
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

async function getDocuments(benefit, applicants, primary, hasTransmerica) {
  // NOTE: doesn't look like `hasTransmerica` is being used anywhere?
  // however, it's being set and passed into this function above...
  const documents = []
  const document = await getDocument(applicants, benefit.HealthPlanId)

  const s3Result = await s3.getObject({
    Bucket: document.bucket,
    Key: document.key,
  }).promise()

  documents.push({
    documentId: '1',
    name: document.filename,
    documentBase64: s3Result.Body.toString('base64'),
    documentFields: [
      { name: 'cartId', value: primary.Id },
      { name: 'hiosId', value: benefit.HealthPlanId },
    ],
    documentLocation: {
      bucket: document.bucket,
      key: document.key,
    },
  })

  return documents
}

async function getDocument(applicants, hios) {
  const document = {}
  const getFilledWithRetries = tryFor(4, 500)(getFilledDocument, res => !!res)
  const result = await getFilledWithRetries(applicants, hios)
  const components = result.data.split('/')

  document.bucket = components[0]
  document.key = result.data.substring(result.data.indexOf('/') + 1)
  document.filename = components[components.length - 1]

  return document
}

const waitFor = (time, ...args) => new Promise(resolve => setTimeout(resolve, time, ...args))

const tryFor = (times, delay, dieOffRate = 1) => (fn, isOk) => async (...args) => {
  let timesTried = 0

  while (timesTried++ <= times) {
    const result = await fn(...args)
    if (isOk(result)) {
      return result
    }
    await waitFor(delay * (1 + Math.log(Math.pow(dieOffRate, timesTried - 1))))
  }
  throw new Error(`Method ${fn.name} was tried too many times.`)
}

async function getFilledDocument(applicants, hios) {
  const params = {
    FunctionName: `get-filled-pdf-application:${stage}`,
    Payload: JSON.stringify({ employeeGraph: applicants, HIOS_ID: hios, stage }, null, 2),
  }
  let response = await lambda.invoke(params).promise()
  try {
    response = JSON.parse(response.Payload)
  } catch (err) {
    console.error(err)
  }
  return response
}

function getPrimarySigner(healthIns, family) {
  return family
    .find(person => person.Id === healthIns.EmployeePublicKey)
}

async function checkApplicationsAvailable(healthIns) {
  let allAvailable = false

  if (healthIns.Benefits.length > 0) { allAvailable = true }

  await Promise.all(healthIns.Benefits.map(async (benefit) => {
    if (benefit.PdfApplicationAvailable) {
      return benefit
    }
    const available = await applicationAvailable(benefit.HealthPlanId)
    benefit.PdfApplicationAvailable = available
    if (!available) allAvailable = false

    return benefit
  }))

  healthIns.AllApplicationsAvailable = allAvailable
  return healthIns
}

async function applicationAvailable(hiosId) {
  const issuerId = hiosId.substring(0, 5)
  // NOTE: `hiosRegion`, below, isn't being used
  const hiosRegion = hiosId.replace(/[0-9]/g, '')

  const params = {
    TableName: `${stage}-carrier-applications`,
    IndexName: 'HIOS_ISSUER_ID-index',
    ProjectionExpression: [
      'Id',
      'Carrier',
      'ApplicationName',
      'ApplicationPath',
      'Template',
      'TemplateReviewComplete',
      'HIOS_ID',
      'HIOS_ISSUER_ID',
    ].join(', '),
    KeyConditionExpression: 'HIOS_ISSUER_ID = :issuer',
    ExpressionAttributeValues: {
      ':issuer': issuerId,
    },
  }

  const { Items: response } = await docClient.query(params).promise()

  if (!response) {
    return false
  }

  const application = response.find((app) => {
    if (app.HIOS_ID) {
      return app.HIOS_ID.indexOf(hiosId) !== -1
    }
    return false
  })

  return !(!application || !application.TemplateReviewComplete)
}

function getHealthIns(cart) {
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
