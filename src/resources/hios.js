import AWS from 'aws-sdk'

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

/* eslint-disable no-nested-ternary */
export const getApplicationTemplate = async (hios) => {
  const template = await docClient.query({
    TableName: 'prod-carrier-application-hios',
    IndexName: 'Hios-index',
    KeyConditionExpression: 'Hios = :hios',
    ExpressionAttributeValues: { ':hios': hios },
  }).promise();
};
