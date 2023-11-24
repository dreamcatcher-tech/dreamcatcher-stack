/**
 * Manages multiple threads, segregated by path they were called at.
 * Will open a new thread if none is present.
 * Can reconstruct a thread if none exists.
 * May ask for results of function calls.
 * Will fork and apply the function calls, so the end result can be considered
 * so we avoid catastrophe and give the AI time to consider.
 */
import OpenAI from 'openai'
import posix from 'path-browserify'
import { useAsync, useAI, useState } from '../../w002-api'
import process from 'process'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:apps:threads')
const endings = ['cancelled', 'failed', 'completed', 'expired']

const api = {
  user: {
    type: 'object',
    title: 'USER',
    description: 'A user prompt, which is a request for the AI to do something',
    additionalProperties: false,
    required: ['text'],
    properties: { text: { type: 'string' }, key: { type: 'string' } },
  },
}
const context = {}

const defaultAI = {
  name: 'GPT4',
  assistant: { instructions: 'You are a CLI terminal' },
  model: 'gpt-4-1106-preview',
}

// Each state change should represent a single piece of the conversation

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'USER': {
      const { key } = request.payload
      let [{ threadId, assistantId, path }, setState] = await useState()
      let { name, assistant } = defaultAI

      if (path !== '(default)') {
        const [ai] = await useAI(path)
        assert(ai.name === 'GPT4', `ai name is ${ai.name}`)
        name = ai.name
        assistant = ai.assistant
      }

      if (!assistantId) {
        // see if there is an assistant with this name
        const assistants = await useAsync(async () => {
          const list = await context.openAI.beta.assistants.list({
            order: 'desc',
            limit: '100',
          })
          // TODO loop to get all assistants
          return list.data
        }, 'key-assistant-list')
        const existing = assistants.find((a) => a.name === path)
        debug('assistant', existing.id, existing.name)
        if (existing) {
          assistantId = existing.id
          // compare with what we expect the assistant to be
          // warn if different
          // update the API function calls
          // add a special synthetic call to query another bot
        } else {
          // create the assistant
          const assistantId = await useAsync(async () => {
            const { tools, model, instructions } = assistant
            const result = await context.openAI.beta.assistants.create({
              name: path,
              instructions,
              tools,
              model,
            })
            debug('create assistant', result.id, result.name)
            return result.id
          })
          await setState({ assistantId })
        }
      } else {
        // check that the assistant is still valid
      }
      if (!threadId) {
        // create the thread and set the ID
        threadId = await useAsync(async () => {
          const thread = await context.openAI.beta.threads.create()
          // TODO add metadata for the root chainId, path, and thread pulseId
          debug('create thread', thread)
          return thread.id
        }, 'key-thread-create')
        debug('threadId', threadId)
        await setState({ threadId })
      } else {
        // check the thread has the assistant set
        // check the thread data matches what we have on chain
      }

      // add the message
      const { text } = request.payload
      const messageId = await useAsync(async () => {
        const result = await context.openAI.beta.threads.messages.create(
          threadId,
          { role: 'user', content: text }
        )
        debug('message', result.thread_id, result.id)
        return result.id
      }, 'key-message-create')
      debug('messageId', messageId)

      // TODO block concurrent runs occuring
      const runId = await useAsync(async () => {
        const result = await context.openAI.beta.threads.runs.create(threadId, {
          assistant_id: assistantId,
        })
        return result.id
      }, 'key-run-create')
      debug('runId', runId)

      let isRunning = true
      while (isRunning) {
        // poll the run
        const run = await useAsync(async () => {
          Debug.enable('iplog *:threads')
          const result = await context.openAI.beta.threads.runs.retrieve(
            threadId,
            runId
          )
          if (!endings.includes(result.status)) {
            await new Promise((r) => setTimeout(r, 300))
          }
          return result
        }, 'key-run-poll')
        debug('poll runId', run.id)
        if (endings.includes(run.status)) {
          isRunning = false
        }
      }

      // the run has completed, so we can get the messages
      const message = await useAsync(async () => {
        const result = await context.openAI.beta.threads.messages.list(
          threadId,
          { before: messageId }
        )
        assert(result.data.length === 1, `message count: ${result.data.length}`)
        return result.data[0]
      }, 'key-message-list')

      debug('message', message)

      return { text: message.content[0].text.value }
    }
    case '@@INIT': {
      let { path } = request.payload.installer.state
      assert(posix.isAbsolute(path), `must have absolute path: ${path}`)
      let [ai] = await useAI(path)
      if (!ai) {
        ai = defaultAI
        path = '(default)'
      }
      const { name, instructions } = ai
      assert.strictEqual(name, 'GPT4', `ai name is ${name}`)
      // TODO check the instruction against the api schema format
      if (!context.openAI) {
        const env = import.meta.env || process.env
        const { VITE_OPENAI_API_KEY, OPENAI_API_KEY } = env
        const apiKey = VITE_OPENAI_API_KEY || OPENAI_API_KEY
        if (!apiKey) {
          throw new Error('missing openai api key')
        }
        context.openAI = new OpenAI({
          apiKey,
          dangerouslyAllowBrowser: true,
        })
      }
      return { installer: { state: { path } } }
    }
    default: {
      throw new Error(`unknown request: ${request.type}`)
    }
  }
}

const name = 'threads'
const installer = {
  state: { threadId: null, assistantId: null },
  config: { isPierced: true },
}
export { name, api, reducer, installer }

const injectedResponses = []
export function injectResponses(...responses) {
  injectedResponses.push(...responses)
}
