import { isError, isString } from 'lodash'
import circular from 'circular-json'
import http from 'http'
import ware from 'warewolf'

const defaultResponseConfig = {
  headers: {
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
  isBase64Encoded: false,
  statusCode: 200,
}

function responseController(
  getResults = ({ result }) => (
    /* eslint-disable no-nested-ternary */
    typeof result === 'string'
      ? { result }
      : Array.isArray(result)
        ? result
        : { ...result }
  ),
  config = {},
) {
  return (event, context, done) => {
    const result = getResults(event)
    const response = {
      ...defaultResponseConfig,
      ...config,
      headers: {
        ...defaultResponseConfig.headers,
        ...config.headers,
      },
      body: circular.stringify(result),
    }
    done(null, response)
  }
}

const errorHandler = (error, event, context, done) => {
  if (isError(error)) {
    const { statusCode, type, message } = getFormattedError(error, event)
    const isInDebugMode = process.env.SLS_DEBUG === '*'
    const isDevOrInt = ['dev', 'int'].some(env => process.env.STAGE.toLowerCase() === env)
    const shouldPrintStack = isInDebugMode && isDevOrInt
    // add stack trace if running in 'dev' or 'int, and have opted-in
    const stack = shouldPrintStack ? error.stack : undefined

    done(null, {
      ...defaultResponseConfig,
      statusCode,
      body: JSON.stringify({
        status: statusCode,
        type,
        message,
        stack,
      }),
    })
  }
  done()
}

function getFormattedError(error = {}, event = {}) {
  let { statusCode = 500 } = event
  if (error.statusCode) {
    ({ statusCode } = error)
  }
  if (Number.isInteger(error)) {
    statusCode = error
  }
  statusCode = Number.parseInt(statusCode, 10)
  const type = http.STATUS_CODES[statusCode] || 'An Error Has Occured'
  const message = `${statusCode}: ${type}`

  return { statusCode, type, message }
}

export const before = ware(async (event = {}) => {
  const {
    queryStringParameters = {},
    pathParameters = {},
    body = {},
  } = event

  Object.assign(
    event,
    { stage: process.env.STAGE },
    { params: ({ ...queryStringParameters, ...pathParameters, ...event.query }) },
    { body: isString(body) ? JSON.parse(body) : body },
  )
})

export const after = ware(
  async (event) => {
    Object.assign({}, defaultResponseConfig, {
      body: event.result || event.results || {},
    })
  },

  responseController(),
  errorHandler,
)

export const isTrue = (value) => {
  if (value && (
    value === 'true' ||
    value === true ||
    value === '1' ||
    value === 1)) {
    return true
  }
  return false
}

export const stripNonAlphaNumericChars = value => `${value}`.replace(/[^\w\s]*/gi, '')

export const queryStringIsTrue = queryString => isTrue(stripNonAlphaNumericChars(queryString))
