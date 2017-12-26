#!/usr/bin/env node

//   1.  Query and find all 2017 enrollments FOR WHICH 'KAISER' WAS SELECTED AS A
//       HEALTH BENEFIT;
//   2.  Using *THOSE* workers and the resulting list, now query for each worker's
//       2018 enrollments;'
//   3.  Filter that list down to only those who either:
//       - i.   EXPLICITLY ELECTED to decline 2018 health benefits; or
//       - ii.  DID NOT ELECT ANYTHING for their 2018 health benefits;
//   4.  The resulting list contains all workers who require signing a term letter
//       - [and who shold also receive SMS message(s)]
//   5.  Iterate through list from #4 and create a new, single DocuSign [using the
//       term-letter template] for each worker/family
//       - i.  In the case that the term-letter form itself requires multiple
//         signatures, we'll end up w/ multiple URLs, each corresponding to the
//         required signer
//   6.  Create AND/OR Update each worker's `enrollment` record(s) to include the
//       KAISER cancelation form docusign ID
//       - [and possibly add some signing statuses, etc.)


import {
  getCurrentYearPlan,
  getNextYearPlan,
  getPlanAttribute,
  getPreviousPlanAttribute,
  getPreviousYearPlan,
  workerCurrentlyHasAHealthPlan,
  workerPreviouslyHadAHealthPlan,
} from '../resources'

const run = async (employeePublicKey) => {
  const currentPlan = await getCurrentYearPlan(employeePublicKey)
  const previousPlan = await getPreviousYearPlan(employeePublicKey)
  const nextPlan = await getNextYearPlan(employeePublicKey)

  console.dir({
    currentPlan,
    previousPlan,
    nextPlan,
  })
  // console.dir(await workerCurrentlyHasAHealthPlan(employeePublicKey))
  // console.dir(await workerPreviouslyHadAHealthPlan(employeePublicKey))
}

// const mockGregID = '4b1e2183-b627-47bd-91ef-184ce2db9b24'
const realGregID = '153d2716-97b8-43ef-9471-3eb02e0cda6f'

run(realGregID)
