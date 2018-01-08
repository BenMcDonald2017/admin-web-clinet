import aws from 'aws-sdk'
import { get } from 'delver'
import moment from 'moment'
import { isProd } from '../utils'

const docClient = new aws.DynamoDB.DocumentClient({ region: 'us-west-2' })

const kaiserCarriers = ['40513CA']
const healthNetCarriers = ['99110CA', '67138CA']
const kaiserChangeForm = isProd ? 'cbeeae49-56de-4065-95b8-97b6fafb2189' : '5a450cb3-da73-44d9-8eba-e0902073fc00'
const genericCancelation = isProd ? 'b59a56bd-4990-488e-a43f-bf37ad00a63b' : '79a9dad3-011c-4094-9c01-7244b9303338'

export const getPlanAttribute = async ({
  attribute,
  employeePublicKey = ' ',
  fromYear = '',
  returnNakedBenefits = false,
}) => {
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

  fromYear = startOfYear(fromYear || undefined)

  // Ensure healthPlans are .
  const currentPlans = benefits.filter(health => moment(fromYear).isSame(moment(health.BenefitEffectiveDate), 'year'))

  // if one elects to receive the naked (untouched) benefit
  if (returnNakedBenefits === true || (typeof attribute === 'undefined' || attribute == null || !attribute)) {
    return currentPlans
  }

  // otherwise, at this point, the function caller must desire an attribute from
  // said plan.  ALSO: `currentPlans` can contain multiple entries; this currently
  // chooses only the first plan!
  return get({ currentPlans }, `currentPlans[0].${attribute}`, '')
}

// some easy plan-getting functions
export const getCurrentYearPlan = (employeePublicKey = ' ') => getPlanAttribute({ employeePublicKey, returnNakedBenefits: true })
export const getNextYearPlan = (employeePublicKey = ' ') => getNextPlanAttribute({ employeePublicKey, returnNakedBenefits: true })
export const getPreviousYearPlan = (employeePublicKey = ' ') => getPreviousPlanAttribute({ employeePublicKey, returnNakedBenefits: true })

// booleans:
export const workerCurrentlyHasAHealthPlan = async (employeePublicKey = ' ') => (Boolean(getPlanAttribute({ employeePublicKey, attribute: 'HealthPlanId' })))
export const workerWillNextYearHaveAHealthPlan = async (employeePublicKey = ' ') => (Boolean(getNextPlanAttribute({ employeePublicKey, attribute: 'HealthPlanId' })))
export const workerPreviouslyHadAHealthPlan = async (employeePublicKey = ' ') => (Boolean(getPreviousPlanAttribute({ employeePublicKey, attribute: 'HealthPlanId' })))

export function startOfYear(YYYY = '') {
  if (/^\d{4}$/i.test(YYYY)) {
    return moment(`${YYYY}-01-01T00:00:00.000`).startOf('year')
  }
  // else, return the start of _this_ year
  return moment().startOf('year')
}

export async function getChangeOrCancelationForms({ employeePublicKey = ' ', HIOS = ' ' }) {
  const currentPlans = await getPreviousYearPlan(employeePublicKey)
  return getNecessaryForms({ currentPlans, HIOS })
}

export const getPreviousPlanAttribute = async (args = {}) => getPlanAttribute({
  ...args, // pass all incoming args to `getPlanAttribute()`
  fromYear: moment().subtract(1, 'year').format('YYYY'),
})

export const getNextPlanAttribute = async (args = {}) => getPlanAttribute({
  ...args, // pass all incoming args to `getPlanAttribute()`
  fromYear: moment().add(1, 'year').format('YYYY'),
})

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
  // the worker DIDN'T end up chosing the same plan again)—AND—they don't already
  // have the `genericCancelation` form, give it to them
  if (issuers.length && !issuers.includes(HIOS.slice(0, 7)) && !forms.includes(genericCancelation)) {
    forms.push(genericCancelation)
  }

  return forms
}
