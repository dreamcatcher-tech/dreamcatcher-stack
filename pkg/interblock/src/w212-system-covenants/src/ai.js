/**
 * ? how to stream back an AI response into a chain ?
 * Probably make a new pulse each response that comes in, and then do a
 * history shortcut when its finished, so the stream path can be pruned.
 * Stream back a generator, so can be yielded multiple times
 * Provide a hack where a side channel can be used to tap partial responses
 *
 * Want to load up the whole filesystem, copy in the files, then start bots.
 *
 * Could make all AI requests go thru a gateway, so it can be throttled, and
 * logged globally.
 *
 * Since the updates are ephemeral, provide them out of band.
 * Once the action resolves, replace with a permanent thing.
 */
import all from 'it-all'
import OpenAI from 'openai'
import Debug from 'debug'
import { useAsync } from '../../w002-api'
const debug = Debug('interblock:apps:ai')

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
  const { prompt, history, topP } = request.payload
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
  if (!context.openAi) {
    context.openAi = new OpenAI()
  }
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
