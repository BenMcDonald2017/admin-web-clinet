import { isObject } from 'lodash'
import AWS from 'aws-sdk'
import moment from 'moment'

export const {
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

export function getSignerObject(params) {
  return {
    email: params.email,
    name: `${params.first} ${params.last}`,
    clientUserId: params.id,
    recipientId: params.id,
  }
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
