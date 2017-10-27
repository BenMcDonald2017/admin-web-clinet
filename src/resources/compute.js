import aws from 'aws-sdk'

const DEFAULT_REGION = process.env.npm_package_config_region
const DEFAULT_STAGE = process.env.npm_package_config_stage

const { STAGE = DEFAULT_STAGE } = process.env
const lambda = new aws.Lambda({ region: DEFAULT_REGION })

export const invokeLambda = async (functionName = '', payload = {}, options = {}) => {
  const {
    requestContext = null,
    appendStage = true,
  } = options

  const rawResponse = await (lambda.invoke({
    FunctionName: `${functionName}${appendStage ? `:${process.env.STAGE}` : ''}`,
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: JSON.stringify({
      ...payload,
      requestContext,
    }),
  }).promise())
  const response = JSON.parse(rawResponse.Payload)
  if (response && response.errorMessage) {
    throw new Error(`invokeLambda ${functionName} error ${response.errorMessage}, request payload ${JSON.stringify(payload)}`)
  }
  return response
}

// const invokeLambda2 = async (nameArg = '', payload = {}, setStage = true) => {
//   const name = nameArg.indexOf(':') === -1 && setStage ? [nameArg, process.env.STAGE].join(':') : nameArg
//   payload.Stage = payload.Stage || STAGE

//   const params = {
//     FunctionName: name,
//     InvocationType: 'RequestResponse',
//     LogType: 'Tail',
//     Payload: JSON.stringify(payload),
//   }
//   const res = await lambda.invoke(params).promise()
//   return res.Payload ? JSON.parse(res.Payload) : null
// }

export const saveDocuSignEnvelopeToEnrollment = (event) => {
  if (!event || !event.result || !event.result.created) {
    const error = new Error('DocuSign Envelope Could Not Be Found')
    error.statusCode = 400
    throw error
  }

  const { authorizer } = event.requestContext
  const { claims } = authorizer

  invokeLambda('bundle-signatures-put', {
    pathParameters: {
      // EnrollmentPublicKey: '10908a4c-5ca8-4c69-82a1-788fd6416239',
      EnrollmentPublicKey: event.enrollmentPublicKey,
    },
    body: {
      Signatures: [{
        // BundlePublicKey: 'b041a93e-7a1c-46cc-aaf4-e0ef7877f418',
        BundlePublicKey: event.bundlePublicKey,
        // DocuSignEnvelopeId: '785b91c7-756b-443e-8971-65d20e0ebaee',
        DocuSignEnvelopeId: event.result.docuSignEnvelopeId,
        ClientUserId: event.result.clientUserId,
      }],
    },
    requestContext: {
      authorizer: {
        claims,
        // claims: {
        //   'custom:user-role': 'PlatformEmployee',
        //   'cognito:username': 'b6c4e54b-66a6-4807-8436-bfab0ace2b60',
        //   email: 'c.bumstead@hixme.com',
        // },
      },
    },
  })
}

export const getBenefitsEffectiveDate = employeePublicKey =>
  invokeLambda('get-client-enrollment-settings', {
    EmployeePublicKey: employeePublicKey,
  })

export const getAgeFactor = (stateProvince, effectiveAge) =>
  invokeLambda('get-age-factor', {
    EffectiveAge: effectiveAge,
    StateProvince: stateProvince,
  })

export const getEnrollmentQuestions = clientPublicKey =>
  invokeLambda('get-enrollment-questions', {
    ClientPublicKey: clientPublicKey,
    TableName: `${STAGE}-enrollment-questions`,
  })

export const getPersonGraph = employeePublicKey =>
  invokeLambda('get-person-graph', {
    PersonPublicKey: employeePublicKey,
  }).then(result => result)

export const getPerson = employeePublicKey =>
  invokeLambda('get-person', {
    PersonPublicKey: employeePublicKey,
  }).then(result => result)

export const getEnrollmentResponses = employeePublicKey =>
  invokeLambda('get-enrollment-responses-graph', {
    PersonPublicKey: employeePublicKey,
    PersonTableName: `${STAGE}-persons`,
    EnrollmentResponsesTableName: `${STAGE}-enrollment-responses`,
  })

export const getDoctorsInNetwork = (employeePublicKey, hiosIds) =>
  invokeLambda('get-doctors-in-network', {
    EmployeePublicKey: employeePublicKey,
    PlanHiosIds: hiosIds,
    PreferredDoctorsTableName: `${STAGE}-preferred-doctors`,
  })

export const getRatingAreas = zipcodes =>
  invokeLambda(`search-locations:${STAGE}`, {
    zipCodes: zipcodes,
  })

export const getCoveredHospitals = (stateProvince, ratingArea) =>
  invokeLambda('get-db-covered-hospitals', {
    RatingArea: ratingArea,
    StateProvince: stateProvince,
  })

export const getStateApprovals = () =>
  invokeLambda('get-gap-insurance-approvals')

export const getHixmeConnectRates = () =>
  invokeLambda('get-trans-connect-rates')

export const getGapFinancingLevels = () =>
  invokeLambda('get-gap-financing')

export const getGapAssumptions = () =>
  invokeLambda('get-gap-assumptions')

export const getHealthPlans = async (stateProvince, ratingArea, includeNotForSale, healthPlanId) =>
  invokeLambda('get-health-plans', {
    StateProvince: stateProvince,
    RatingArea: ratingArea,
    HiosIds: healthPlanId && String(healthPlanId),
    IncludeNotForSale: includeNotForSale,
    IncludeInactive: false,
  })

export const getHealthPlanById = async (healthPlanId) => {
  const plans = await getHealthPlans(null, null, null, healthPlanId)
  return plans && plans[0]
}

export const getAgeFactorsRange = async Payload =>
  invokeLambda('age-factors-range', Payload)

export const getContributionGroups = async ClientPublicKey =>
  invokeLambda('get-contribution-groups', {
    ClientPublicKey,
    Verbose: true,
  })

export const getClientContributions = async (ClientPublicKey,
  StateProvince, RatingArea, ContributionGroup) =>
  invokeLambda('get-reference-plan', {
    ClientPublicKey,
    StateProvince,
    RatingArea,
    ContributionGroup,
  })

export const getClientBundleConfig = async ClientPublicKey =>
  invokeLambda('get-client-bundle-config', {
    ClientPublicKey,
    Verbose: true,
  })

export const getHealthPlansForAgeAndRatingArea = async (stateRatingArea, ages) => {
  const state = stateRatingArea.slice(0, 2)
  const ratingArea = stateRatingArea.slice(2, -1)
  const plans = await getHealthPlans(
    state,
    ratingArea,
    false,
  )
  let ageFactors = await getAgeFactorsRange({
    AgesByState: { [state]: ages },
  })
  ageFactors = ageFactors[state]
  return {
    plans,
    ageFactors,
  }
}

export const getEnrollment = async (enrollment) => {
  const payload = await invokeLambda(`enrollment-service-${process.env.STAGE}-bundle-groups-get`, {
    pathParameters: {
      EnrollmentPublicKey: enrollment,
    },
  }, false)
  return JSON.parse(payload.body)
}

export const getGapInsurances = () =>
  invokeLambda('get-gap-insurances')

export const getSmokerFactors = (stage, stateProvince) =>
  invokeLambda(`get-smoker-factors:${stage}`, {
    StateProvince: stateProvince,
  })
