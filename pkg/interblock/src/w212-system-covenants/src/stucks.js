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
          type: 'Artifact',
          instructions: `The CRM is installed at the path /apps/crm.  The customers collection is at the path /apps/crm/customers.  To add a customer, the minimum information that the user has to provide is the customer name.  Once added, use the 'cd' command to change directory into the new customer path that will look something like: /apps/crm/customers/{custNo}`,
          done: `You should see a new customer at the path /apps/crm/customers/{custNo} with the information you provided to the 'add' function`,
          tld: '/apps/crm/customers',
          cmds: ['/cd', '/apps/crm/customers/add'],
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
