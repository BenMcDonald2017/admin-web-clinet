import aws from 'aws-sdk'
import moment from 'moment'
import { isProd } from '../utils'

const docClient = new aws.DynamoDB.DocumentClient({ region: 'us-west-2' })

const kaiserCarriers = ['40513CA']
const healthNetCarriers = ['99110CA', '67138CA']
const kaiserChangeForm = isProd ? '31c1ad8c-0ac6-4f0f-9676-277a23f3452e' : '5a450cb3-da73-44d9-8eba-e0902073fc00'
const genericCancelation = isProd ? 'b59a56bd-4990-488e-a43f-bf37ad00a63b' : '79a9dad3-011c-4094-9c01-7244b9303338'

export async function getChangeForms({ employeePublicKey = ' ', HIOS = ' ' /* , members  = [] */ }) {
  const { Items: benefits = [] } = await docClient.query({
    TableName: `${process.env.STAGE}-benefits`,
    IndexName: 'EmployeePublicKey-index',
    FilterExpression: 'IsActive = :isActive AND BenefitType = :benefitType',
    KeyConditionExpression: 'EmployeePublicKey = :employeePublicKey',
    ExpressionAttributeValues: {
      ':employeePublicKey': employeePublicKey,
      ':benefitType': 'HealthBundle',
      ':isActive': true,
    },
  }).promise()

  const currentPlans = benefits.filter(health => moment().isBetween(
    moment(health.BenefitEffectiveDate),
    moment(health.BenefitEndDate), 'days', '[]',
  ))

  return getNecessaryForms({ currentPlans, HIOS /* , members */ })
}

const getNecessaryForms = ({ curretPlans = [], HIOS = '' /* , members  = [] */ }) => {
  const forms = []
  const issuers = curretPlans.map(plan => plan.HealthPlanId.slice(0, 7))
  const hadKaiser = issuers.some(c => kaiserCarriers.includes(c))
  const hadHealthNet = issuers.some(c => healthNetCarriers.includes(c))
  const willHaveKaiser = kaiserCarriers.includes(HIOS.slice(0, 7))
  const willHaveHealthNet = healthNetCarriers.includes(HIOS.slice(0, 7))

  // if person used to have a `Kaiser` plan...
  if (hadKaiser) {
    if (willHaveKaiser) {
      forms.push(kaiserChangeForm)
    } else {
      forms.push(genericCancelation)
    }
  }

  // if person used to have a `HealthNet` plan...
  if (hadHealthNet) {
    if (!willHaveHealthNet && !forms.includes(genericCancelation)) {
      forms.push(genericCancelation)
    }
  }

  // if person _doesn't_ have a plan with an identical HIOS carrier ID (meaning,
  // person chose same plan again)—AND—they don't already have `genericCancelation` form
  if (!issuers.includes(HIOS.slice(0, 7)) && !forms.includes(genericCancelation)) {
    forms.push(genericCancelation)
  }

  return forms
}
