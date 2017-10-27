import { isString } from 'lodash'
import fetch from 'node-fetch'
import QS from 'qs'
import URL from 'url-parse'

const {
  STAGE,
  DOCUSIGN_PASSWORD,
  DOCUSIGN_IKEY,
  DOCUSIGN_USER,
  DOCUSIGN_PASSWORD_PROD,
  DOCUSIGN_IKEY_PROD,
  DOCUSIGN_USER_PROD,
} = process.env

export const getRootUrl = () => (
  STAGE === 'prod'
    ? 'https://na2.docusign.net/restapi/v2/accounts/43952094'
    : 'https://demo.docusign.net/restapi/v2/accounts/1840519'
)

const getDocusignUrl = path => `${getRootUrl()}${path}`

const COMMON_DOCUSIGN_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

const getDocusignAuthHeaders = () => (
  STAGE === 'prod'
    ? ({
      Username: DOCUSIGN_USER_PROD,
      Password: DOCUSIGN_PASSWORD_PROD,
      IntegratorKey: DOCUSIGN_IKEY_PROD,
    })
    : ({
      Username: DOCUSIGN_USER,
      Password: DOCUSIGN_PASSWORD,
      IntegratorKey: DOCUSIGN_IKEY,
    })
)

const getDocusignHeaders = () =>
  ({
    ...COMMON_DOCUSIGN_HEADERS,
    'X-DocuSign-Authentication': JSON.stringify(getDocusignAuthHeaders()),
  })

const formatPath = (path, params) =>
  path.replace(/({[^}]+})/g, match => params[match.slice(1, -1)])

const fetchDocuSign = (path, defaults = {}) =>
  async ({
    headers = {}, params = {}, query = {}, ...options
  } = {}) => {
    const {
      headers: defaultHeaders = {},
      params: defaultParams = {},
      query: defaultQuery = {},
      ...defaultOptions
    } = defaults
    const fullUrl = getDocusignUrl(formatPath(path, {
      ...defaultParams,
      ...params,
    }))
    const parsedUrl = new URL(fullUrl, QS.parse)
    parsedUrl.set('query', {
      ...parsedUrl.query,
      ...defaultQuery,
      ...query,
    })
    const fetchParams = [
      parsedUrl.toString(),
      {
        headers: {
          ...getDocusignHeaders(),
          ...defaultHeaders,
          ...headers,
        },
        ...defaultOptions,
        ...options,
      },
    ]

    if (fetchParams[1].body && !isString(fetchParams[1].body)) {
      fetchParams[1].body = JSON.stringify(fetchParams[1].body)
    }
    const res = await fetch(...fetchParams)
    if (!res.ok) {
      throw new Error(`Docusign API Error: ${res.statusText} ${fetchParams[0]}`)
    }
    if (fetchParams[1].format === 'base64') {
      const buffer = await res.buffer()
      return buffer.toString('base64')
    }

    return res.json()
  }

export const getDocusignAuth = async () => {
  const fetchParams = {
    headers: {
      ...getDocusignHeaders(),
    },
  }
  const res = await fetch(
    STAGE === 'prod'
      ? 'https://www.docusign.net/restapi/v2/login_information' // PROD
      : 'https://demo.docusign.net/restapi/v2/login_information', // INT
    fetchParams,
  )
  if (!res.ok) {
    throw new Error(`Docusign API Error: ${res.statusText}`)
  }

  return res.json()
}

export const createEnvelope = fetchDocuSign('/envelopes', { method: 'POST' })

export const createEmbeddedEnvelope = fetchDocuSign(
  '/envelopes/{envelopeId}/views/recipient',
  { method: 'POST' },
)

export const getEnvelope = fetchDocuSign(
  '/envelopes/{envelopeId}',
  { method: 'GET' },
)

export const getEnvelopes = fetchDocuSign(
  '/envelopes/',
  { method: 'GET' },
)

export const fetchDocuSignURL = (url, options = {}) => fetchDocuSign(url)(options)
