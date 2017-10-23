import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import ware from 'warewolf'

import { before, after } from '../../../utils'

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

// GET 'docusign session'
export const getSigningSession = ware(
  before,

  async (event) => {
    const { personPublicKey, envelopeId, returnUrl } = event
    const stage = `${event.stage || process.env.STAGE}`.toLowerCase()
    const isProd = stage === 'prod' ? '_PROD' : ''

    const config = {
      personTable: `${stage}-persons`,
      ACCOUNT_ID: process.env[`DOCUSIGN_ACCOUNT_ID${isProd}`],
      BASE_URL: process.env[`DOCUSIGN_BASE_URL${isProd}`],
      USER_NAME: process.env[`DOCUSIGN_USER${isProd}`],
      PASSWORD: process.env[`DOCUSIGN_PASSWORD${isProd}`],
      INTEGRATOR_KEY: process.env[`DOCUSIGN_IKEY${isProd}`],
    }

    const person = await getPerson(personPublicKey, config.personTable).Item

    event.result = await createSigningSession(person, envelopeId, returnUrl, config)
  },

  after,
)

export async function createSigningSession(person, envelopeId, returnUrl, config) {
  const body = {
    email: person.HixmeEmailAlias,
    clientUserId: person.Id,
    userName: `${person.FirstName} ${person.LastName}`,
    authenticationMethod: 'email',
    returnUrl,
  }

  await fetch({
    url: `${config.BASE_URL}/accounts/${config.ACCOUNT_ID}/envelopes/${envelopeId}/views/recipient`,
    method: 'POST',
    json: true,
    headers: {
      Accept: 'application/json',
      'X-DocuSign-Authentication': JSON.stringify({
        Username: config.USER_NAME,
        Password: config.PASSWORD,
        IntegratorKey: config.INTEGRATOR_KEY,
      }),
    },
    body: JSON.stringify(body),
  }).then(response => ({ url: response.url })).catch(e => new Error(e.statusCode, e.error))
}

function getPerson(personPublicKey, tableName) {
  return docClient.get({
    TableName: tableName,
    Key: { Id: personPublicKey },
  }).promise()
}
