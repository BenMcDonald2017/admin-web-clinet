import aws from 'aws-sdk'
import { get } from 'delver'
import moment from 'moment'
import { isProd } from '../utils'

const docClient = new aws.DynamoDB.DocumentClient({ region: 'us-west-2' })

const kaiserCarriers = ['40513CA']
const healthNetCarriers = ['99110CA', '67138CA']
const kaiserChangeForm = isProd ? 'cbeeae49-56de-4065-95b8-97b6fafb2189' : '5a450cb3-da73-44d9-8eba-e0902073fc00'
const genericCancelation = isProd ? 'b59a56bd-4990-488e-a43f-bf37ad00a63b' : '79a9dad3-011c-4094-9c01-7244b9303338'

export async function getChangeOrCancelationForms({ employeePublicKey = ' ', HIOS = ' ' }) {
  const currentPlans = await getPreviousPlanAttribute(employeePublicKey, true)
  return getNecessaryForms({ currentPlans, HIOS })
}

// NOTE: we're calling the functions below the worker's "previous" plan. In reality though,
// anyone coming through this code block would necessarily be looking for a new plan, and
// at the point whereby they need documents generated.  So, at this moment, the worker's
// current plan is really their "previous" plan. Make sense?
export async function getPreviousPlanAttribute(employeePublicKey = ' ', attribute = ' ', returnNakedBenefits = false) {
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

  // check if today `moment()` is between benefit's `BenefitEffectiveDate`
  // and its `BenefitEndDate`.
  const currentPlans = benefits.filter(health => moment().isBetween(
    moment(health.BenefitEffectiveDate),
    moment(health.BenefitEndDate), 'days', '[]',
  ))

  // if one elects to receive the naked (untouched) benefit
  if (attribute === true || returnNakedBenefits === true) {
    return currentPlans
  }

  // `currentPlans` can contain multiple entries; we are currently choosing the first
  return get({ currentPlans }, `currentPlans[0].${attribute}`, '')
}

export async function workerPreviousHadAHealthPlan(employeePublicKey = ' ') {
  return Boolean(getPreviousPlanAttribute(employeePublicKey, 'HealthPlanId'))
}

export async function workerCurrentlyHasAHealthPlan(employeePublicKey = ' ') {
  return Boolean(getPreviousPlanAttribute(employeePublicKey, 'HealthPlanId'))
}

const getNecessaryForms = ({ currentPlans = [], HIOS = '' }) => {
  const forms = []
  const issuers = currentPlans.map(plan => plan.HealthPlanId.slice(0, 7))

  const workerPreviouslyHadKaiser = issuers.some(carrier => kaiserCarriers.includes(carrier))
  const workerWillHaveKaiser = kaiserCarriers.includes(HIOS.slice(0, 7))
  const workerPreviouslyHadHealthNet = issuers.some(carrier => healthNetCarriers.includes(carrier))
  const workerWillHaveHealthNet = healthNetCarriers.includes(HIOS.slice(0, 7))

  // if person used to have a `Kaiser` plan...
  if (workerPreviouslyHadKaiser) {
    if (workerWillHaveKaiser) {
      forms.push(kaiserChangeForm)
    } else {
      forms.push(genericCancelation)
    }
  }

  // if person used to have a `HealthNet` plan...
  if (workerPreviouslyHadHealthNet) {
    if (!workerWillHaveHealthNet && !forms.includes(genericCancelation)) {
      forms.push(genericCancelation)
    }
  }

  // if person _doesn't_ have a plan with an identical HIOS carrier ID (meaning,
  // person chose same plan again)—AND—they don't already have `genericCancelation` form
  if (issuers.length && !issuers.includes(HIOS.slice(0, 7)) && !forms.includes(genericCancelation)) {
    forms.push(genericCancelation)
  }

  return forms
}
