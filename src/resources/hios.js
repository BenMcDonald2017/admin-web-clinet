import { isObject } from 'lodash'
import AWS from 'aws-sdk'
import moment from 'moment'

const {
  STAGE: stage,
  EFFECTIVE_DATE = '20180101',
  HEALTH_BUNDLE = 'HealthBundle',
} = process.env

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

/* eslint-disable no-nested-ternary */
export const getApplicationTemplate = hios => {

};
