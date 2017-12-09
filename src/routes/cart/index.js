// from: 'get-cart-with-application-status-lambda'

import { isObject, noop } from 'lodash'
import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import moment from 'moment'

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })
const lambda = new AWS.Lambda({ region: 'us-west-2' })
const s3 = new AWS.S3()
const {
  EFFECTIVE_DATE = '20180101',
  HEALTH_BUNDLE = 'HealthBundle',
} = process.env

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
    const kids = applicants.Children.filter(kid => effectiveAge(kid.DateOfBirth, EFFECTIVE_DATE) >= 18)

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

function getPrimarySigner(healthIns, family) {
  return family
    .find(person => person.Id === healthIns.EmployeePublicKey)
}

function getHealthIns(cart, config) {
  return cart.find(benefit => benefit.BenefitType === HEALTH_BUNDLE)
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
