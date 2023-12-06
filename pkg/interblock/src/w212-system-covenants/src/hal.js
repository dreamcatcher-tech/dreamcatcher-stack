/**
 * This is the thread management system for the AI.
 */
import all from 'it-all'
import OpenAI from 'openai'
import Debug from 'debug'
import {
  Request,
  ensureChild,
  interchain,
  useAsync,
  useState,
} from '../../w002-api'
import process from 'process'

const debug = Debug('interblock:apps:ai')

const schema = {
  // the schema for the whole state
  type: 'object',
  title: 'HAL',
  description: `HAL is the executing AI.  It is the junction point between artifact and AI activity.
  
  The AI is separate from the application because the data should not change just by having an AI conversation with it.`,
}

const api = {
  prompt: {
    type: 'object',
    title: 'PROMPT',
    description: 'Send a prompt to HAL',
    additionalProperties: false,
    required: ['prompt'],
    properties: {
      prompt: { type: 'string' },
    },
  },
}

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'PROMPT': {
      const text = request.payload.prompt
      const action = { type: 'USER', payload: { text } }
      const result = await interchain(action, '.goalie')
      // TODO error handling if no goals are set
      const [{ order }] = await useState('/.goalie')
      const [topGoal] = order
      const [goal] = await useState('/.goalie/' + topGoal)
      console.log(order, topGoal, goal)
      return result
    }
    case '@@INIT': {
      return
    }
    default: {
      throw new Error(`unknown request: ${request.type}`)
    }
  }
}

const name = 'hal'
const installer = {
  network: {
    '.goalie': {
      covenant: 'threads',
      state: { path: '/.goalie' },
    },
  },
}
export { name, api, reducer, schema, installer }
