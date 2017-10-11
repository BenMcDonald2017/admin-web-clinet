import aws from 'aws-sdk';

const DEFAULT_STAGE = process.env.npm_package_config_stage;
const DEFAULT_REGION = process.env.npm_package_config_region;

const { STAGE = DEFAULT_STAGE } = process.env;
const lambda = new aws.Lambda({ region: DEFAULT_REGION });

export /* REMOVE EXPORT! */ const invokeLambda = async (nameArg, payload = {}, setStage = true) => {
  const name = nameArg.indexOf(':') === -1 && setStage ? [nameArg, process.env.STAGE].join(':') : nameArg;
  payload.Stage = payload.Stage || STAGE;
  const params = {
    FunctionName: name,
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: JSON.stringify(payload),
  };
  const res = await lambda.invoke(params).promise();
  return res.Payload ? JSON.parse(res.Payload) : null;
};

export const getBenefitsEffectiveDate = employeePublicKey =>
  invokeLambda('get-client-enrollment-settings', {
    EmployeePublicKey: employeePublicKey,
  });

// export const getAgeFactor = (stateProvince, effectiveAge) =>
//   invokeLambda('get-age-factor', {
//     EffectiveAge: effectiveAge,
//     StateProvince: stateProvince,
//   });

export const getEnrollmentQuestions = clientPublicKey =>
  invokeLambda('get-enrollment-questions', {
    ClientPublicKey: clientPublicKey,
    TableName: `${STAGE}-enrollment-questions`,
  });

export const getPersonGraph = employeePublicKey =>
  invokeLambda('get-person-graph', {
    PersonPublicKey: employeePublicKey,
  }).then(result => result);

export const getPerson = employeePublicKey =>
  invokeLambda('get-person', {
    PersonPublicKey: employeePublicKey,
  }).then(result => result);

export const getEnrollmentResponses = employeePublicKey =>
  invokeLambda('get-enrollment-responses-graph', {
    PersonPublicKey: employeePublicKey,
    PersonTableName: `${STAGE}-persons`,
    EnrollmentResponsesTableName: `${STAGE}-enrollment-responses`,
  });

export const getDoctorsInNetwork = (employeePublicKey, hiosIds) =>
  invokeLambda('get-doctors-in-network', {
    EmployeePublicKey: employeePublicKey,
    PlanHiosIds: hiosIds,
    PreferredDoctorsTableName: `${STAGE}-preferred-doctors`,
  });

export const getRatingAreas = zipcodes =>
  invokeLambda(`search-locations:${STAGE}`, {
    zipCodes: zipcodes,
  });

export const getCoveredHospitals = (stateProvince, ratingArea) =>
  invokeLambda('get-db-covered-hospitals', {
    RatingArea: ratingArea,
    StateProvince: stateProvince,
  });

export const getStateApprovals = () =>
  invokeLambda('get-gap-insurance-approvals');

export const getHixmeConnectRates = () =>
  invokeLambda('get-trans-connect-rates');

export const getGapFinancingLevels = () =>
  invokeLambda('get-gap-financing');

export const getGapAssumptions = () =>
  invokeLambda('get-gap-assumptions');

export const getHealthPlans = async (stateProvince, ratingArea, includeNotForSale, healthPlanId) =>
  invokeLambda('get-health-plans', {
    StateProvince: stateProvince,
    RatingArea: ratingArea,
    HiosIds: healthPlanId && String(healthPlanId),
    IncludeNotForSale: includeNotForSale,
    IncludeInactive: false,
  });

export const getHealthPlanById = async (healthPlanId) => {
  const plans = await getHealthPlans(null, null, null, healthPlanId);
  return plans && plans[0];
};

export const getAgeFactorsRange = async Payload =>
  invokeLambda('age-factors-range', Payload);

export const getContributionGroups = async ClientPublicKey =>
  invokeLambda('get-contribution-groups', {
    ClientPublicKey,
    Verbose: true,
  });

export const getClientContributions = async (ClientPublicKey,
  StateProvince, RatingArea, ContributionGroup) =>
  invokeLambda('get-reference-plan', {
    ClientPublicKey,
    StateProvince,
    RatingArea,
    ContributionGroup,
  });

export const getClientBundleConfig = async ClientPublicKey =>
  invokeLambda('get-client-bundle-config', {
    ClientPublicKey,
    Verbose: true,
  });

export const getHealthPlansForAgeAndRatingArea = async (stateRatingArea, ages) => {
  const state = stateRatingArea.slice(0, 2);
  const ratingArea = stateRatingArea.slice(2, -1);
  const plans = await getHealthPlans(
    state,
    ratingArea,
    false,
  );
  let ageFactors = await getAgeFactorsRange({
    AgesByState: { [state]: ages },
  });
  ageFactors = ageFactors[state];
  return {
    plans,
    ageFactors,
  };
};

export const getEnrollment = async (enrollment) => {
  const payload = await invokeLambda(`enrollment-service-${process.env.STAGE}-bundle-groups-get`, {
    pathParameters: {
      EnrollmentPublicKey: enrollment,
    },
  }, false);
  return JSON.parse(payload.body);
};

export const getGapInsurances = () =>
  invokeLambda('get-gap-insurances');

export const getSmokerFactors = (stage, stateProvince) =>
  invokeLambda(`get-smoker-factors:${stage}`, {
    StateProvince: stateProvince,
  });
