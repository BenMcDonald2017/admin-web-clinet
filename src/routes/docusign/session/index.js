import AWS from 'aws-sdk'
import fetch from 'node-fetch'
import ware from 'warewolf'

import { before, after } from '../../../utils'
import { getDocusignEmbeddedEnvelopeController } from '../../../controllers'

const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-west-2' })

// create signing session
export const createSigningSession = ware(
  before,

  async (event) => {
    await getDocusignEmbeddedEnvelopeController(event)
  },

  after,
)
