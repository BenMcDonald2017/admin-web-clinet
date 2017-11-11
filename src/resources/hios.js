import AWS from 'aws-sdk'

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

export const getDocuSignApplicationTemplate = async hios => docClient.query({
  TableName: 'prod-carrier-application-hios',
  IndexName: 'Hios-index',
  KeyConditionExpression: 'Hios = :hios',
  ExpressionAttributeValues: { ':hios': hios },
}).promise()
