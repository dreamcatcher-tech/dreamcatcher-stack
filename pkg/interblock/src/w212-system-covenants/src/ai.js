/**
 * This is the thread management system for the AI.
 */
import all from 'it-all'
import OpenAI from 'openai'
import Debug from 'debug'
import { useAsync, useState } from '../../w002-api'
import process from 'process'

const debug = Debug('interblock:apps:ai')

const api = {
  prompt: {
    type: 'object',
    title: 'PROMPT',
    description:
      'Send a prompt to the AI and start streaming back the response. The reply will be the full reply from the model. Partial results need to be sampled out of band',
    additionalProperties: false,
    required: ['prompt', 'key'],
    properties: {
      prompt: { type: 'string' },
      key: {
        type: 'string',
        description: `unique key for this request to allow side band access to streaming data`,
      },
    },
  },
  target: {
    type: 'object',
    title: 'TARGET',
    description: 'Set the target for the AI to converse about',
    additionalProperties: false,
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: `path to the chain to converse about`,
      },
    },
    // this should really be set at creation time and not change ?
  },
}
const context = {}

const reducer = async (request) => {
  debug('request', request)
  const { prompt, key } = request.payload
  switch (request.type) {
    case 'PROMPT': {
      const message = { role: 'user', content: prompt }
      const messages = [message]
      const results = await useAsync(async () => {
        if (injectedResponses.length) {
          return [injectedResponses.pop()]
        }
        const results = await all(stream(messages))
        debug('effect results', results)
        return results
      }, key)
      const result = results.join('')
      debug('result', result)
      return { result }
    }
    case '@@INIT': {
      if (!context.openAi) {
        const env = import.meta.env || process.env
        const { VITE_OPENAI_API_KEY, OPENAI_API_KEY } = env
        const apiKey = VITE_OPENAI_API_KEY || OPENAI_API_KEY
        if (!apiKey) {
          throw new Error('missing openai api key')
        }
        context.openAi = new OpenAI({
          apiKey,
          dangerouslyAllowBrowser: true,
        })
      }
      return
    }
    case 'TARGET': {
      // set the target chain for the AI to converse about
      const { path } = request.payload
      debug('path', path)
      // verify we can access the path

      const [state, setState] = useState()
      if (state.path !== path) {
        await setState({ path })
      }
      return
    }
    case 'THREAD': {
      // takes in a path to a thread object, and will use that thread to
      // run the assistant that this object represents.
      // check the functions in the assistant are loaded up correctly

      // if we are root, we own our own thread, otherwise we receive
      // the thread
      return
    }
    default: {
      throw new Error(`unknown request: ${request.type}`)
    }
  }
}

/**
 * Think this covenant is an AINode ? Acts as a decorator around the complex.
 * Get our current path in the complex.
 * Contact the openai api to see if there is an assistant at this path.
 * If not, make one, using the defaults.
 * If there is, then use it.
 *
 * How to know what our current path is ?
 *
 * Talk to self should both own the conversation and respond to it
 *
 */

async function* stream(messages) {
  debug('messages', messages)

  const stream = await context.openAi.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  })
  for await (const part of stream) {
    const result = part.choices[0]?.delta?.content || ''
    yield result
  }
}

const name = 'ai'
const installer = { config: { isPierced: true } }
export { name, api, reducer, installer }

const injectedResponses = []
export function injectResponses(...responses) {
  injectedResponses.push(...responses)
}

/**
 * Do not change an ainode just by talking to it
 * All the threading should be managed in the shell, or in a child chain
 * Reasoning should be tracked in chains.
 *
 * In the shell means that shell would read from the Be's of the chain
 * and then make the call, and then give the result back.
 * Shell could be extended with AI call capabilities and the ability to make
 *
 * So shell takes in all prompts ?
 * Or, is HAL the shell prompt now, and shell is merely what it has available ?
 *
 * This means that HAL as a Be which tells it how to interpret the environment.
 * Prompts must always come in to the root first.
 *
 * Or we could run HAL as an assistant in openAI ?
 * How would we get multibot going then ?
 *
 * If use the Threads tool, then there is no need for anything more than to
 * do the async call, with the relevant functions loaded up.
 *
 * ls --description to get a description about what an object is.
 * Use threads since that is fastest way to get high quality output going.
 *
 * ? How to use the behaviours in a given ainode ?
 * It would be a different thread, or we might make a new thread for it ?
 * Or, it could carry on its last thread, for more context ?
 * So HAL's role is to limit what the ainodes can consider.
 * Assistant definitely needed for parsing bank statements.
 * Might need to teach it how to write mango queries with an iteration loop.
 *
 * Could upload text of the whole db so it can be searched.
 * Keep it updated on change.
 *
 * Could upload the whole xml file of the db for code interpreter to process.
 *
 * Can make new threads to allow agents to work separately without wrecking
 * a thread they were not supposed to change ?
 * Or, just give them some isolated space.
 */
