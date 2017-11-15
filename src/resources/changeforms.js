import aws from 'aws-sdk';
import moment from 'moment';

const docClient = new aws.DynamoDB.DocumentClient({ region: 'us-west-2' });

const kaiserCarriers = ['40513CA'];
const healthNetCarriers = ['99110CA', '67138CA'];
const kaiserChangeForm = 'cbeeae49-56de-4065-95b8-97b6fafb2189';
const genericCancellation = 'b59a56bd-4990-488e-a43f-bf37ad00a63b';

// const bundle = {
//   employeePublicKey: '50c1c8f7-d07f-455e-909c-68a3070607e3',
//   hios: '40512CA0120001',
//   members: [{
//     RatingArea: 16,
//     FirstName: 'Ron',
//     StateProvince: 'CA',
//     Relationship: 'Employee',
//     BenefitStatus: 'Included',
//     PostalCode: '90405',
//     Id: '50c1c8f7-d07f-455e-909c-68a3070607e3',
//     LastName: 'Jonestown',
//   }],
// };

export async function getChangeForms(bundle) {
  const { employeePublicKey, hios, members } = bundleData;
  const { Items: plans } = await docClient.query({
    TableName: 'int-benefits',
    IndexName: 'EmployeePublicKey-index',
    FilterExpression: 'IsActive = :isActive AND BenefitType = :benefitType',
    KeyConditionExpression: 'EmployeePublicKey = :employeePublicKey',
    ExpressionAttributeValues: {
      ':employeePublicKey': employeePublicKey,
      ':benefitType': 'HealthBundle',
      ':isActive': true,
    },
  }).promise();
  const currentPlans = plans.filter(health =>
    moment().isBetween(moment(health.BenefitEffectiveDate),
      moment(health.BenefitEndDate), 'days', '[]'));
  return getNecessaryForms(currentPlans, hios, members);
}

const getNecessaryForms = (curretPlans, newHios, people) => {
  const forms = [];
  if (!curretPlans.length) return [];
  const issuers = curretPlans.map(plan => plan.HealthPlanId.slice(0, 7));
  const hadKaiser = issuers.some(c => kaiserCarriers.includes(c));
  const hadHealthNet = issuers.some(c => healthNetCarriers.includes(c));
  const willHaveKaiser = kaiserCarriers.includes(newHios.slice(0, 7));
  const willHaveHealthNet = healthNetCarriers.includes(newHios.slice(0, 7));

  if (hadKaiser) {
    if (willHaveKaiser) {
      forms.push(kaiserChangeForm);
    } else {
      forms.push(genericCancellation);
    }
  }
  if (hadHealthNet) {
    if (!willHaveHealthNet && !forms.includes(genericCancellation)) {
      forms.push(genericCancellation);
    }
  }
  if (!issuers.includes(newHios.slice(0, 7)) && !forms.includes(genericCancellation)) {
    forms.push(genericCancellation);
  }

  return forms;
};