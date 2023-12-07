/**
 * This is the thread management system for the AI.
 */
import all from 'it-all'
import OpenAI from 'openai'
import Debug from 'debug'
import { interchain, useState } from '../../w002-api'
import assert from 'assert-fast'

const debug = Debug('interblock:apps:ai')

const schema = {
  // the schema for the whole state
  type: 'object',
  title: 'HAL',
  description: `HAL is the executing AI.  It is the junction point between artifact and AI activity.
  
  The AI is separate from the application because the data should not change just by having an AI conversation with it.`,
  additionalProperties: false,
  properties: {
    currentGoalId: {
      type: 'string',
      description: `The path to the current goal that is executing`,
    },
  },
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
      // prior, grab the latest HAL message from the current thread
      // if there is one, and then insert that into the goalie thread
      // format the goalie prompts so we can tell it in plain language
      // what the output is

      // we can loop to force the goalie to make a call

      const text = request.payload.prompt
      const action = { type: 'USER', payload: { text } }
      const newMessages = await interchain(action, '.goalie')
      // TODO error handling if no goals are set
      const [{ allGoalIdsPrioritized }] = await useState('/.goalie')
      assert(Array.isArray(allGoalIdsPrioritized))
      if (!allGoalIdsPrioritized.length) {
        console.dir(newMessages, { depth: 10 })
        throw new Error('no goals')
      }
      assert(allGoalIdsPrioritized.length)
      const [topGoal] = allGoalIdsPrioritized
      const [goal] = await useState('/.goalie/' + topGoal)
      console.log(allGoalIdsPrioritized, topGoal, goal)
      return newMessages

      // now start a new thread that points at the goal,
      // or reinvigorate the existing one
      // send in the prompt to it, and set the current
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
