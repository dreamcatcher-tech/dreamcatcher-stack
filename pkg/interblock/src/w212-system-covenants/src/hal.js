/**
 * This is the thread management system for the AI.
 */
import Debug from 'debug'
import {
  useApi,
  ensureChild,
  interchain,
  useAsync,
  useState,
} from '../../w002-api'
import merge from 'lodash.merge'
import all from 'it-all'
import OpenAI from 'openai'
import assert from 'assert-fast'
import process from 'process'

const debug = Debug('interblock:apps:hal')

const schema = {
  // the schema for the whole state
  type: 'object',
  title: 'Threads',
  description: `HAL is the executing AI.  It is the junction point between artifact and AI activity.
  
  The AI is separate from the application because the data should not change just by having an AI conversation with it.`,
  additionalProperties: false,
  required: ['messages'],
  properties: {
    messages: {
      type: 'array',
      description: `The messages that have been sent to the user so far`,
      items: {
        type: 'object',
        properties: {
          type: {
            enum: ['USER', 'HAL', 'GOALIE'],
            description: `The type of message`,
          },
          text: {
            type: 'string',
            description: `The text of the message`,
          },
        },
      },
    },
    threadId: {
      type: 'string',
      description: `The threadId of the current conversation`,
    },
    assistantId: {
      type: 'string',
      description: `The assistantId of the current conversation`,
    },
  },
}

const api = {
  prompt: {
    type: 'object',
    title: 'PROMPT',
    description:
      'Send a prompt to the AI and start streaming back the response. The reply will be the full reply from the model. Partial results need to be sampled out of band',
    additionalProperties: false,
    required: ['prompt'],
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
  const { prompt } = request.payload
  switch (request.type) {
    case 'PROMPT': {
      const message = { role: 'user', content: prompt }
      const messages = [message]
      const results = await useAsync(async () => {
        const results = await all(stream(messages))
        return results
      })
      const { content, toolCalls } = accumulate(results)
      debug('result:', content, toolCalls)
      if (content) {
        return { content }
      } else {
        // make the tool call
        assert(toolCalls.length === 1, 'only one tool call supported')
        const toolCall = toolCalls[0].function
        assert(toolCall.name === 'stuckloop', 'only stuckloop supported')

        const { functions } = await useApi('stucks')
        const { helps } = await functions.help(toolCall.arguments)
        debug('helps', helps)

        await useWithHelp(messages, helps)
        // debug('toolCalls', toolCalls)
      }
      return
    }
    case '@@INIT': {
      if (!context.ai) {
        const env = import.meta.env || process.env
        const { VITE_OPENAI_API_KEY, OPENAI_API_KEY } = env
        const apiKey = VITE_OPENAI_API_KEY || OPENAI_API_KEY
        if (!apiKey) {
          throw new Error('missing openai api key')
        }
        context.ai = new OpenAI({
          apiKey,
          dangerouslyAllowBrowser: true,
        })
      }
      await ensureChild('stucks', { covenant: 'stucks' })
      return
    }
    default: {
      throw new Error(`unknown request: ${request.type}`)
    }
  }
}
const name = 'hal'
const installer = { state: { path: '/' }, config: { isPierced: true }, schema }
export { name, api, reducer, installer }

const useWithHelp = async (messages, helps) => {
  const bot = {
    role: 'system',
    content: `You are an expert in following instructions from the help system. The instructions for using the help are provided below:
  
  ${helps[0].instructions}`,
  }
  messages = [...messages, bot]
}

async function* stream(messages) {
  debug('messages', messages)

  // inject an assistant message
  messages = [
    ...messages,
    {
      role: 'system',
      content: `You are an expert at goal detection.  Keep your replies to less than 160 characters.  You may use emoji which does not count against the 160 character limit of your responses. 
      
      Tackling the users requests one at a time, your job is to figure out what the user wants to do enough to call the stuckloop function.  The stuckloop function will then provide you with the instructions to complete the task.  The answers are arranged in an FAQ style format so think of calling the stuckloop like making a search query in stackoverflow.

      The query should be generic and not include any specific nouns - remember you are searching the public internet for instructions with this call.

      If you are not clear on how to structure this query, ask clarifying questions until you are confident in making the stuckloop call.
      `,
    },
  ]

  // have a separate prompt that calls when we have the helps available

  const tools = [
    {
      type: 'function',
      function: {
        name: 'stuckloop',
        description:
          'Retrieve instructions how to complete a given task.  The instructions are indexed in a FAQ style format',
        parameters: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: 'The goal to retrieve instructions for',
            },
          },
          required: ['goal'],
        },
      },
    },
  ]

  const streamCall = await context.ai.chat.completions.create({
    model: 'gpt-4-1106-preview',
    messages,
    stream: true,
    seed: 1337,
    tools,
    logprobs: true,
    // tool_choice: { type: 'function', function: { name: 'stuckloop' } },
  })
  for await (const part of streamCall) {
    const content = part.choices[0]?.delta?.content || ''
    const toolCalls = part.choices[0]?.delta?.tool_calls || []
    yield { content, toolCalls }
  }
}
const accumulate = (results) => {
  let content = ''
  let toolCalls = []
  for (const result of results) {
    content += result.content
    if (result.toolCalls) {
      for (const call of result.toolCalls) {
        let { index, ...rest } = call
        assert(Number.isInteger(index), 'toolCalls index must be an integer')
        let args = toolCalls[index]?.function?.arguments || ''
        args += rest?.function?.arguments || ''
        rest = merge({}, rest, { function: { arguments: args } })
        toolCalls[index] = merge({}, toolCalls[index] || {}, rest)
      }
    }
  }
  toolCalls.map((call) => {
    call.function.arguments = JSON.parse(call.function.arguments)
  })
  return { content, toolCalls }
}
