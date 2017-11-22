// from: 'get-cart-with-application-status-lambda'

import { isObject, noop } from 'lodash'
import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import moment from 'moment'

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })
const lambda = new AWS.Lambda({ region: 'us-west-2' })
const s3 = new AWS.S3()

const CHECK_TIME = false

/* eslint-disable no-console */
const markTime = CHECK_TIME ? console.time.bind(console) : noop
const markTimeEnd = CHECK_TIME ? console.timeEnd.bind(console) : noop

async function createEnvelope(applicants, signers, documents, primary, config) {
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

  await fetch(`${config.BASE_URL}/accounts/${config.ACCOUNT_ID}/envelopes`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-DocuSign-Authentication': JSON.stringify({
        Username: config.USER_NAME,
        Password: config.PASSWORD,
        IntegratorKey: config.INTEGRATOR_KEY,
      }),
    },
    body: JSON.stringify(body),
  }).then(response => (response.json().envelopeId)).catch(e => new Error(e.statusCode, e.error))
}

/* eslint-disable no-nested-ternary */
const forcePlain = arg => (Array.isArray(arg)
  ? arg.map(forcePlain)
  : (isObject(arg) ? Object.assign({}, arg) : arg))

function getSigners(family, config) {
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
    /* eslint-disable max-len */
    const kids = applicants.Children.filter(kid => effectiveAge(kid.DateOfBirth, config.EFFECTIVE_DATE) >= 18)

    /* eslint-disable no-plusplus */
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

function getSignerObject(person) {
  return {
    clientUserId: `${person.id}`,
    email: `${person.email}`,
    name: `${person.first} ${person.last}`,
    recipientId: `${person.id}`,
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

async function getDocuments(benefit, applicants, primary, hasTransmerica, config) {
  const documents = []
  markTime('get-doc')
  const document = await getDocument(applicants, benefit.HealthPlanId, config)
  markTimeEnd('get-doc')

  markTime('get-bucket')
  const s3Result = await s3.getObject({
    Bucket: document.bucket,
    Key: document.key,
  }).promise()
  markTimeEnd('get-bucket')

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

async function getDocument(applicants, hios, config) {
  const document = {}
  const getFilledWithRetries = tryFor(4, 500)(getFilledDocument, res => !!res)
  const result = await getFilledWithRetries(applicants, hios, config)
  const components = result.data.split('/')
  const bucket = components[0]

  document.bucket = bucket
  document.key = result.data.substring(result.data.indexOf('/') + 1)
  document.filename = components[components.length - 1]

  return document
}

const waitFor = (time, ...args) => new Promise(resolve => setTimeout(resolve, time, ...args))

const tryFor = (times, delay, dieOffRate = 1) => (fn, isOk) => async (...args) => {
  let timesTried = 0

  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-plusplus */
  // C.f. https://eslint.org/docs/rules/no-await-in-loop
  while (timesTried++ <= times) {
    const result = await fn(...args)
    if (isOk(result)) {
      return result
    }
    await waitFor(delay * (1 + Math.log(dieOffRate ** (timesTried - 1))))
  }
  throw new Error(`Method ${fn.name} was tried too many times.`)
}

async function getFilledDocument(applicants, hios, config) {
  const params = {
    FunctionName: `get-filled-pdf-application:${config.stage}`,
    Payload: JSON.stringify({ employeeGraph: applicants, HIOS_ID: hios, stage: config.stage }, null, 2),
  }
  markTime(`get-doc-check-${hios}`)
  let response = await lambda.invoke(params).promise()
  markTimeEnd(`get-doc-check-${hios}`)
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

async function checkApplicationsAvailable(healthIns, config) {
  let allAvailable = false

  if (healthIns.Benefits.length > 0) { allAvailable = true }

  await Promise.all(healthIns.Benefits.map(async (benefit) => {
    if (benefit.PdfApplicationAvailable) {
      return benefit
    }
    const available = await applicationAvailable(benefit.HealthPlanId, config)
    benefit.PdfApplicationAvailable = available
    if (!available) allAvailable = false

    return benefit
  }))

  healthIns.AllApplicationsAvailable = allAvailable
  return healthIns
}

async function applicationAvailable(hiosId, config) {
  const issuerId = hiosId.substring(0, 5)
  // const hiosRegion = hiosId.replace(/[0-9]/g, '');

  const params = {
    TableName: config.applicationTable,
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

function getHealthIns(cart, config) {
  return cart.find(benefit => benefit.BenefitType === config.HEALTH_BUNDLE)
}

async function getCart(Id, tableName) {
  return docClient.get({
    TableName: tableName,
    Key: { EmployeePublicKey: Id },
  }).promise()
}

async function saveCart(item, tableName) {
  return docClient.put({
    TableName: tableName,
    Item: item,
  }).promise()
}

async function getFamily(employeePublicKey, config) {
  const { Items: family } = await docClient.query({
    TableName: config.personsTable,
    IndexName: 'EmployeePublicKey-index',
    FilterExpression: 'IsActive = :isActive',
    KeyConditionExpression: 'EmployeePublicKey = :key',
    ExpressionAttributeValues: {
      ':key': employeePublicKey,
      ':isActive': true,
    },
  }).promise()

  return Promise.all(family.map(async (person) => {
    person.SSN = await getSSN(person.Id, config.stage)
    return person
  }))
}

async function getSSN(personPublicKey, stage) {
  const response = await lambda.invoke({
    FunctionName: `get-ssn:${stage}`,
    Payload: JSON.stringify({ PersonPublicKey: personPublicKey }, null, 2),
  }).promise()

  return JSON.parse(response.Payload).SSN
}

function effectiveAge(birthday, effectiveDate) { // birthday is a date
  return moment(effectiveDate, 'YYYYMMDD').diff(moment(birthday), 'years')
}
