/**
 * This is the thread management system for the AI.
 */
import all from 'it-all'
import OpenAI from 'openai'
import Debug from 'debug'
import { useAsync } from '../../w002-api'
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
}
const context = {}

const reducer = async (request) => {
  debug('request', request)
  const { prompt, key } = request.payload
  switch (request.type) {
    case 'PROMPT': {
      const message = { role: 'user', content: prompt }
      const messages = [message]
      const results = await useAsync(() => {
        if (injectedResponses.length) {
          return [injectedResponses.pop()]
        }
        return all(stream(messages))
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
          apiKey: OPENAI_API_KEY,
          dangerouslyAllowBrowser: true,
        })
      }
      return
    }
    default: {
      throw new Error(`unknown request: ${request.type}`)
    }
  }
}

/**
 * Threads api usage
 * Each new message that comes in, add to the thread and invoke the assistant
 * We should always have a link to the artifact that we shadow
 * The shadow contains the assistant
 * The caller contains the thread
 *
 * So you would add a message to the thread, ensure an assistant was created
 * for the target you wanted to chat with, and then start up a run instance
 * to get the cycle going.
 *
 * Each add to the thread checks that we still have a good model of remote
 *
 */

async function* stream(messages) {
  const results = []
  debug('messages', messages)

  const stream = await context.openAi.chat.completions.create({
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
