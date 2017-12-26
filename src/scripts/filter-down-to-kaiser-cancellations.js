#!/usr/bin/env node

/* eslint-disable max-len */

import moment from 'moment'
import workers from '../../../../../../Downloads/persons.json'

const carrierNamesToInclude = ['kaiser', 'kaiser permanente']
const companyIDsToFilterOut = [
  '895a62f5-3a37-4033-be5d-84cde71c4abd', // "j2 Global, Inc."
  'f576dc35-4061-4bfb-827c-c60b3aed63d1', // "Pier 39"
  // 'c707418c-95ee-4e7c-a228-834bbd8e8894', // :"Westlake Village Inn"
]
const companyNamesToFilterOut = [
  'j2', 'pier 39', 'hixme mock inc', 'globex', // 'westlake village inn',
]
const workersWithKaiserPlansIn2017 = []
const workersWithKaiserPlansIn2018 = []

const workersNeedingToCancel2017KaiserPlan = workers.filter((worker) => {
  // don't include TEST workers
  if (worker.IsTestUser) return false
  // don't include NON-ACTIVE workers
  if (worker.IsActive === false) return false

  // grab benefits from worker
  const { benefits } = worker
  // get all worker benefits and filter out NON-ACTIVE ones
  const allWorkerHealthBenefits = benefits.filter(benefit => (/^health\s*bundle$/igm.test(benefit.BenefitType) && benefit.IsActive))
  const userHasHealthBenefits = allWorkerHealthBenefits  && allWorkerHealthBenefits.length

  // return if worker DOES NOT have health benefits
  if (!userHasHealthBenefits) return false

  // filter worker's benefits to ONLY include KAISER
  const filteredHealthBenefits = allWorkerHealthBenefits.filter((benefit) => {
    const carrierNameMatchesWhitelist = carrierNamesToInclude.map((carrier) => {
      if (typeof carrier !== 'undefined' && carrier != null) {
        return RegExp(`${carrier}`, 'igm').test(benefit.CarrierName)
      }
      return false
    }).some(regexTestResults => regexTestResults === true)

    // returning all and only thise benefits that have a mctahing carrier name
    // to the ones listed above, at the top
    return carrierNameMatchesWhitelist ? benefit : false
  })

  // the destructuring below will set 'currentPlan' to the first of however many
  // current plans that the worker has
  const [currentPlan, ...moreCurrentPlans] = filteredHealthBenefits.filter(benefit => moment().isBetween(
    moment(benefit.BenefitEffectiveDate),
    moment(benefit.BenefitEndDate), 'days', '[]',
  ))

  const [nextPlan, ...moreNextPlans] = filteredHealthBenefits.filter(benefit => moment('2018-01-02').isBetween(
    moment(benefit.BenefitEffectiveDate),
    moment(benefit.BenefitEndDate), 'days', '[]',
  ))

  const workerHasMultipleCurrentPlans = moreCurrentPlans && moreCurrentPlans.length
  const workerHasMultipleNextPlans = moreNextPlans && moreNextPlans.length

  if (workerHasMultipleCurrentPlans) {
    console.warn('*'.repeat(80))
    console.dir(`worker has ${1 + moreCurrentPlans.length} total CURRENT plans!`)
  }

  if (workerHasMultipleNextPlans) {
    console.warn('*'.repeat(80))
    console.dir(`worker has ${1 + moreNextPlans.length} total NEXT plans!`)
  }

  // return if worker doesn't have a plan from last year (2017)
  const workerDoesNotHaveACurrentPlan = !currentPlan
  if (workerDoesNotHaveACurrentPlan) return false

  // need to filter out wokers from the above, top-listed company names and IDs
  const matchOnCompanyID = companyIDsToFilterOut.includes(currentPlan.ClientPublicKey)
  const matchOnCompanyName = companyNamesToFilterOut.map((company) => {
    if (typeof company !== 'undefined' && company != null) {
      return RegExp(`${company}`, 'igm').test(currentPlan.CompanyName)
    }
    return false
  }).some(regexTestResults => regexTestResults === true)

  // return if worker is from one of said companies
  if (matchOnCompanyID || matchOnCompanyName) return false

  // *** statistics
  if (currentPlan) workersWithKaiserPlansIn2017.push(currentPlan)
  if (nextPlan) workersWithKaiserPlansIn2018.push(nextPlan)

  // return if worker is keeping KAISER year-over-year
  // that is, they had it in 2017 and 2018
  if (currentPlan && nextPlan) return false

  // at this point, you will have: a 'worker'; their 'currentPlan'(s); and, the
  // worker's 'nextPlan'(s)!
  // console.dir({ worker, currentPlan, nextPlan })
  // console.warn('*'.repeat(80))
  console.warn('Here are some examples of things available to you here: ')
  // console.warn('*'.repeat(80))
  // console.warn('\'CompanyName\' ——> ', currentPlan.CompanyName)
  // console.warn('\'ClientPublicKey\' ——> ', currentPlan.ClientPublicKey)

  return worker
})

// this 'w' variable assigned here so as not to exceed 80-characters wide below
const w = workersNeedingToCancel2017KaiserPlan
const justTheIDsOfWorkersNeedingToCancel2017KaiserPlan = w.map(p => p && p.employeePublicKey)

console.warn('*'.repeat(80))
console.warn('FINAL RESULTS: ')
console.warn(`${workersWithKaiserPlansIn2017.length} had Kaiser in 2017`)
console.warn(`${workersWithKaiserPlansIn2018.length} has Kaiser in 2018`)
console.warn('*'.repeat(80))
console.warn(`${justTheIDsOfWorkersNeedingToCancel2017KaiserPlan.length} workers need KAISER cancelations`)
console.warn('*'.repeat(80))

// list all IDs
console.dir(justTheIDsOfWorkersNeedingToCancel2017KaiserPlan)
