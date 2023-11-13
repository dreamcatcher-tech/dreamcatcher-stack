/**
 * Manages multiple threads, segregated by path they were called at.
 * Will open a new thread if none is present.
 * Can reconstruct a thread if none exists.
 * May ask for results of function calls.
 * Will fork and apply the function calls, so the end result can be considered
 * so we avoid catastrophe and give the AI time to consider.
 */
import all from 'it-all'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import Debug from 'debug'
import { useAsync } from '../../w002-api'
dotenv.config()
const debug = Debug('interblock:apps:ai')
const openAi = new OpenAI()

const api = {
  prompt: {
    type: 'object',
    title: 'PROMPT',
    description:
      'Send a prompt to the AI and start streaming back the response. The reply will be the full reply from the model. Partial results need to be sampled out of band',
    additionalProperties: false,
    required: ['prompt', 'history'],
    properties: {
      // make a selector that stores history in the state
      prompt: { type: 'string' },
      history: {
        type: 'array',
        items: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role: { enum: ['system', 'user', 'assistant'] },
            content: { type: 'string' },
          },
        },
      },
    },
  },
}
const context = {}

const reducer = async (request) => {
  debug('request', request)
  const { prompt, history } = request.payload
  switch (request.type) {
    case 'PROMPT': {
      const message = { role: 'user', content: prompt }
      const messages = [...history, message]
      const results = await useAsync(() => {
        if (injectedResponses.length) {
          return [injectedResponses.pop()]
        }
        return all(stream(messages))
      })
      return { result: results.join('') }
    }
    default: {
      if (request.type !== '@@INIT') {
        throw new Error(`unknown request: ${request.type}`)
      }
    }
  }
}
async function* stream(messages) {
  const results = []
  debug('messages', messages)
  const stream = await openAi.chat.completions.create({
    model: 'gpt-4',
    messages,
    stream: true,
  })
  for await (const part of stream) {
    const result = part.choices[0]?.delta?.content || ''
    results.push(result)
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
 * Where should ai covenants go ?
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
 *
 */
