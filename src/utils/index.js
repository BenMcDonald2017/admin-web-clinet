import circular from 'circular-json';
import http from 'http';
import ware from 'warewolf';

import { isError, isObject, isString } from 'lodash';

const defaultResponseConfig = {
  headers: {
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  },
  isBase64Encoded: false,
  statusCode: 200,
};

function responseController(
  getResults = ({ result }) => (
    typeof result === 'string'
      ? { result }
      : { ...result }
  ),
  config = {},
) {
  return (event, context, done) => {
    const result = getResults(event);
    const response = {
      ...defaultResponseConfig,
      ...config,
      headers: {
        ...defaultResponseConfig.headers,
        ...config.headers,
      },
      body: circular.stringify({
        ...result,
      }),
    };
    done(null, response);
  };
}

const errorHandler = (error, event, context, done) => {
  if (isError(error)) {
    const statusCode = getStatusCode(error, event);
    const defaultError = new Error(http.STATUS_CODES[statusCode] || 'An Error Has Occured');
    const message = `${isError(error) ? error : defaultError}`;
    const type = http.STATUS_CODES[statusCode] || http.STATUS_CODES[500];
    // add stack trace ifs running in 'dev', and have opted-in
    const stack = (process.env.SLS_DEBUG === '*' &&
            process.env.STAGE === 'dev') ? error.stack : undefined;
    const response = {
      ...defaultResponseConfig,
      statusCode,
      body: JSON.stringify({
        status: statusCode,
        type,
        message,
        stack,
      }),
    };
    done(null, response);
  }
  done();
};

function getStatusCode(error = {}, event = {}) {
  const { statusCode = 500 } = event;
  // if (error.statusCode) {
  //   statusCode = error.statusCode;
  // }
  return http.STATUS_CODES[Number.parseInt(statusCode, 10)];
}

export const before = ware(async (event) => {
  // in some contexts, the event will not be an object.
  // and so, we make sure it's an object here
  event = isObject(event) ? event : {};

  // pull out everything from `event` that we care about
  const {
    queryStringParameters = {},
    pathParameters = {},
    body,
  } = event;

    // merge `query`, `stage`, and `body` (if existent), into `event`
  Object.assign(
    event,
    { stage: process.env.STAGE },
    { query: ({ ...queryStringParameters, ...pathParameters, ...event.query }) },
    { body: isString(body) ? JSON.parse(body) : (body || {}) },
  );
});

export const after = ware(
  async (event) => {
    Object.assign({}, defaultResponseConfig, {
      body: circular.stringify(event.results || event.result || {}),
    });
  },

  responseController(),
  errorHandler,
);

export const isTrue = (value) => {
  if (value && (
    value === 'true' ||
    value === true ||
    value === '1' ||
    value === 1)) {
    return true;
  }
  return false;
};

export const stripNonAlphaNumericChars = value => `${value}`.replace(/[^\w\s]*/gi, '');

export const queryStringIsTrue = queryString => isTrue(stripNonAlphaNumericChars(queryString));
