import OpenAI from 'openai'
import { serializeError } from 'serialize-error'
import posix from 'path-browserify'
import {
  interchain,
  useAsync,
  useAI,
  useState,
  schemaToFunctions,
} from '../../w002-api'
import { shell } from '..'
import merge from 'lodash.merge'
import process from 'process'
import assert from 'assert-fast'
import retry from 'retry'
import Debug from 'debug'
const debug = Debug('interblock:apps:threads')

const schema = {
  // the schema for the whole state
  type: 'object',
  title: 'The Goalie',
  description: `The Goalie is a goal management system for the AI
        It works as follows:
            1. Receives the prompt first, directly from the user.
            2. Is run on the current thread, so it has the context within it.
            3. If no current thread, it will create one.
    `,
  additionalProperties: false,
  properties: {
    goals: {
      type: 'array',
      description: `An array of all the goals in the AI, where their index in this array is their goalId`,
      items: { type: 'object' }, // TODO reuse the goal schema
    },
    order: {
      type: 'array',
      description: `An array of all the goalIds in the order they should be in`,
      items: { type: 'integer' },
    },
  },
}

const api = {
  prompt: {
    type: 'object',
    title: 'PROMPT',
    description:
      'A user prompt, which is a request for the AI to do something.  This will be processed by the AI for goal determination',
    additionalProperties: false,
    required: ['text'],
    properties: { text: { type: 'string' }, key: { type: 'string' } },
  },
  addGoal: {
    type: 'object',
    title: 'ADD_GOAL',
    description: `Add a new goal to the AI.  The default status of the goal is 'CREATED'`,
    additionalProperties: false,
    required: ['title', 'description'],
    properties: {
      title: {
        type: 'string',
        description: `title of the goal that should be as short as possible, and no more than 40 characters.  Good examples are: 'Add Customer', 'Check Email', 'Get Weather', 'Find Ungeocoded Customers`,
        maxLength: 40,
      },
      description: {
        type: 'string',
        description: `The description of the goal which allows for richer information that just what is in the title.  This can be up to 500 characters in length`,
        maxLength: 500,
      },
    },
  },
  updateGoal: {
    type: 'object',
    title: 'UPDATE_GOAL',
    description: `Update an existing goal to the AI based on the latest prompt`,
    additionalProperties: false,
    required: ['goalId'],
    oneOf: [{ required: ['title'] }, { required: ['description'] }],
    properties: {
      goalId: { type: 'integer', description: `The id of the goal to update` },
      title: {
        type: 'string',
        description: `title of the goal that should be as short as possible, and no more than 40 characters.  Good examples are: 'Add Customer', 'Check Email', 'Get Weather', 'Find Ungeocoded Customers`,
        maxLength: 40,
      },
      description: {
        type: 'string',
        description: `The description of the goal which allows for richer information that just what is in the title.  This can be up to 500 characters in length`,
        maxLength: 500,
      },
    },
  },
  reorder: {
    type: 'object',
    title: 'REORDER',
    description: `Reorder the goals in the AI`,
    additionalProperties: false,
    required: ['goalIds'],
    properties: {
      goalIds: {
        type: 'array',
        description: `An array of all the goal ids in the new order they should be in`,
        items: { type: 'integer' },
      },
    },
  },
}

const reducer = async (request) => {
  debug('request', request)
  const { text } = request.payload
  switch (request.type) {
    case 'PROMPT': {
      const ai = await useAI('.')
      const [state, setState] = await useState('.')
      const { prompt } = state
      const nextPrompt = merge({}, prompt, { text })
      setState({ prompt: nextPrompt })
      return { prompt: nextPrompt }
    }
    default:
      throw new Error(`unknown request ${request.type}`)
  }
}

/**
How can this be done using the ai slice in the pulse ?


 */
