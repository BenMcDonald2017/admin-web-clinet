import { isObject } from 'lodash'
import AWS from 'aws-sdk'
import moment from 'moment'

const {
  STAGE: stage,
  EFFECTIVE_DATE = '2018-01-01',
  HEALTH_BUNDLE = 'HealthBundle',
} = process.env

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })
const lambda = new AWS.Lambda({ region: 'us-west-2' })

/* eslint-disable no-nested-ternary */
export const forcePlain = arg => (Array.isArray(arg)
  ? arg.map(forcePlain)
  : (isObject(arg) ? Object.assign({}, arg) : arg))

export function getSigners(family) {
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

export function getSignerObject(params) {
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

export function getApplicationPersons(persons, primary, family) {
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
    signerMap.Spouse = primary
    signerMap.Primary = children.pop()
  }
  if (children.length) {
    signerMap.Children = children
  }
  return signerMap
}

export function getPrimarySigner(healthIns = {}, family = []) {
  const primarySignerID = healthIns.EmployeePublicKey
  return family
    .find(person => person.Id === primarySignerID)
}

export function getHealthBundle(cart) {
  return cart.find(benefit => benefit.BenefitType === HEALTH_BUNDLE)
}

export async function getCart(EmployeePublicKey, TableName = `${stage}-cart`) {
  return docClient.get({
    TableName,
    Key: { EmployeePublicKey },
  }).promise()
}

export async function saveCart(Item, TableName = `${stage}-cart`) {
  return docClient.put({
    TableName,
    Item,
  }).promise()
}

export async function getFamily(employeePublicKey, TableName = `${stage}-persons`) {
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

export async function getSSN(personPublicKey) {
  const response = await lambda.invoke({
    FunctionName: `get-ssn:${stage}`,
    Payload: JSON.stringify({ PersonPublicKey: personPublicKey }, null, 2),
  }).promise()

  return JSON.parse(response.Payload).SSN
}

export function effectiveAge(birthday, effectiveDate) { // birthday is a date
  return moment(effectiveDate, 'YYYYMMDD').diff(moment(birthday), 'years')
}
