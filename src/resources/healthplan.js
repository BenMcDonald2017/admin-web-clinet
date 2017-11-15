import aws from 'aws-sdk';
import moment from 'moment';

const docClient = new aws.DynamoDB.DocumentClient({ region: 'us-west-2' })

export async function getCarrierChanged(employeePublicKey, hiosPlandID) {
  const { Items: benefits } = await docClient.query({
    TableName: 'prod-benefits',
    IndexName: 'EmployeePublicKey-index',
    FilterExpression: 'IsActive = :isActive AND BenefitType = :benefitType',
    KeyConditionExpression: 'EmployeePublicKey = :employeePublicKey',
    ExpressionAttributeValues: {
      ':employeePublicKey': employeePublicKey,
      ':benefitType': 'HealthBundle',
      ':isActive': true,
    },
  }).promise();
  const currentPlans = benefits.filter(health =>
    moment().isBetween(moment(health.BenefitEffectiveDate),
      moment(health.BenefitEndDate), 'days', '[]'));
  const issuers = [...new Set(currentPlans.reduce((acc, plan) => {
    acc.push(plan.HealthPlanId.slice(0, 5));
    return acc;
  }, []))];

  return issuers.includes(hiosPlanID.slice(0,5));
}
