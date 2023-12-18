import OpenAI from 'openai'
import { serializeError } from 'serialize-error'
import posix from 'path-browserify'
import { interchain, useState, Request } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:apps:threads')

const schema = {
  type: 'object',
  title: 'The Stucks Manager',
  description: ``,
  additionalProperties: false,
  properties: {},
}

const api = {
  help: {
    type: 'object',
    title: 'HELP',
    description: `Try to retrieve help based on the given goal`,
    additionalProperties: false,
    required: ['goal'],
    properties: {
      goal: {
        type: 'string',
        description: `The goal that the system needs help with`,
      },
    },
  },
}

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'HELP': {
      const helps = [
        {
          goal: 'add a customer',
          helps: [
            {
              instructions: `The CRM is installed at the path /apps/crm so you need to navigate to /apps/crm/customers and then add a customer with the command found at that location named 'add'.  The minimum information you must provide is the customer name.  Never provide the custNo field as this is automatically generated.  In the response from CD you will get the current state stored at the /apps/crm/customers path.  There will be a key named 'template'.  This describes the json-schema required for the call to the 'add' command to add a customer at this location`,
              // steps: [`CD `],
            },
          ],
        },
      ]
      return { helps }
    }
    case '@@INIT': {
      return
    }
    default:
      throw new Error(`unknown request ${request.type}`)
  }
}

const name = 'stucks'
const installer = {
  schema,
  ai: {
    name: 'GPT4',
    assistant: {
      model: 'gpt-4-1106-preview',
      instructions: `
        
      `,
    },
  },
}

export { name, api, reducer, installer }
