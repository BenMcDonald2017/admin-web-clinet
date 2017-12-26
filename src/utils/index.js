import { isError, isString } from 'lodash'
import circular from 'circular-json'
import http from 'http'
import ware from 'warewolf'

export const isProd = /^prod$/i.test(process.env && (process.env.STAGE || process.env.stage))

export const getStatus = thing => text => !!thing.match(new RegExp(`^${text}$`, 'i'))
export const isComplete = getStatus('completed')

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
  getResults = ({ result }) => {
    /* eslint-disable no-nested-ternary */
    switch (typeof result) {
      case 'string':
        return { result }
      case 'object':
        return Array.isArray(result) ? [...result] : { ...result }
      case 'undefined':
        // not sure how we should be handling this
        return { result }
      default:
        return { ...result }
    }
  },
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
      body: Array.isArray(result)
        ? circular.stringify([...result])
        : circular.stringify({ ...result }),
    }
    done(null, response)
  }
}

const errorHandler = (error, event, context, done) => {
  if (isError(error)) {
    const { statusCode, type, message } = getFormattedError(error, event)
    const isInDebugMode = /^\*$/.test(process.env.SLS_DEBUG) // check for '*'
    const isDevOrInt = /^(?:int|dev)$/i.test(process.env.STAGE) // check for 'dev' or 'int'
    const shouldPrintStack = isInDebugMode && isDevOrInt
    // add stack trace if running in 'dev' or 'int, and have opted-in
    const stack = shouldPrintStack ? error.stack : undefined

    done(null, {
      ...defaultResponseConfig,
      headers: {
        ...defaultResponseConfig.headers,
      },
      statusCode,
      body: JSON.stringify({
        status: statusCode,
        type,
        message,
        stack,
      }),
    })
    return
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
  const type = http.STATUS_CODES[statusCode] || 'An Error Has Occurred'
  const message = error.message ? error.message : `${statusCode}: ${type}`

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

export const isTrue = value =>
  value && value != null && [true, 'true', 1, '1', 'yes'].includes(value)

export const stripNonAlphaNumericChars = value => `${value}`.replace(/[^\w\s]*/gi, '')

export const queryStringIsTrue = queryString => isTrue(stripNonAlphaNumericChars(queryString))
