/**
 * Manages multiple threads, segregated by path they were called at.
 * Will open a new thread if none is present.
 * Can reconstruct a thread if none exists.
 * May ask for results of function calls.
 * Will fork and apply the function calls, so the end result can be considered
 * so we avoid catastrophe and give the AI time to consider.
 */
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

const STATUS = {
  USER: {
    BOOTING: 'BOOTING',
    CHECKING: 'CHECKING',
    CREATING: 'CREATING',
    THREADING: 'THREADING',
    MESSAGING: 'MESSAGING',
    DONE: 'DONE',
  },
  HAL: {
    BOOTING: 'BOOTING',
    THINKING: 'THINKING',
    EXECUTING: 'EXECUTING',
    DONE: 'DONE',
  },
}

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'USER': {
      const { key } = request.payload
      let [{ threadId, assistantId, path }, setState] = await useState()
      await addUserMessage(request.payload.text)

      let { name, assistant } = defaultAI
      let api = shell.api
      if (path !== '(default)') {
        const [ai] = await useAI(path)
        if (ai) {
          assert(ai.name === 'GPT4', `ai name is ${ai.name}`)
          name = ai.name
          assistant = ai.assistant
          // const covenant = await interchain('@@COVENANT', {}, path)
          // api = covenant.api
        }
      }
      if (!assistantId) {
        // see if there is an assistant with this name
        const assistants = await useAsync(async () => {
          const params = { order: 'desc', limit: '100' }
          const list = await context.ai.assistantsList(params)
          // TODO loop if more than 100 assistants
          return list.data
        }, 'key-assistant-list')
        let remote = assistants.find((a) => a.name === path)
        if (remote) {
          debug('assistant', remote.id, remote.name)
          assistantId = remote.id
          await setState({ assistantId })

          // TODO add a special synthetic call to query another bot
        } else {
          // create the assistant
          await updateMessageStatus(STATUS.USER.CREATING)
          remote = await useAsync(async () => {
            const { tools, model, instructions } = assistant
            const result = await context.ai.assistantsCreate({
              name: path,
              model,
              tools,
              instructions,
            })
            return result
          }, 'key-assistant-create')
          assistantId = remote.id
          await setState({ assistantId })
        }
        const gpt4Api = transformToGpt4Api(api)
        remote = await useAsync(
          async () =>
            context.ai.assistantsUpdate(assistantId, {
              tools: gpt4Api,
            }),
          'key-update-tools'
        )
      } else {
        // check that the assistant is still valid
        // throw new Error('TODO')
      }
      await updateMessageStatus(STATUS.USER.THREADING)
      if (!threadId) {
        // create the thread and set the ID
        threadId = await useAsync(async () => {
          const thread = await context.ai.threadsCreate()
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

      await updateMessageStatus(STATUS.USER.MESSAGING)
      const { text } = request.payload
      const messageId = await useAsync(async () => {
        const result = await context.ai.messagesCreate(threadId, {
          role: 'user',
          content: text,
        })
        debug('message', result.thread_id, result.id)
        return result.id
      }, 'key-message-create')
      debug('messageId', messageId)
      await updateMessageStatus(STATUS.USER.DONE)

      // TODO block concurrent runs occuring
      await addHalMessage()
      const runId = await useAsync(async () => {
        const result = await context.ai.runsCreate(threadId, {
          assistant_id: assistantId,
        })
        return result.id
      }, 'key-run-create')
      await updateMessageStatus(STATUS.HAL.THINKING)

      debug('runId', runId)

      // run step status: in_progress, cancelled, failed, completed, expired
      let steps = []
      let isRunComplete = false
      do {
        const lastId = getLastStepId(steps)
        const { done, next, tools } = await pollSteps(lastId, threadId, runId)
        isRunComplete = done
        steps = splat(steps, next)

        await updateSteps(steps)

        const last = steps[steps.length - 1]
        if (tools) {
          assert(last.status === 'in_progress' && last.type === 'tool_calls')
          await updateMessageStatus(STATUS.HAL.EXECUTING)
          await execTools(last.step_details, threadId, runId)
          await updateMessageStatus(STATUS.HAL.THINKING)
        }
      } while (!isRunComplete)
      await updateMessageStatus(STATUS.HAL.DONE)
      return
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
      if (!context.ai) {
        context.ai = createAI()
      }
      return { installer: { state: { path, messages: [] } } }
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
export { name, api, reducer, installer, STATUS }

const injectedResponses = []
export function injectResponses(...responses) {
  injectedResponses.push(...responses)
}

const transformToGpt4Api = (api) =>
  Object.entries(api).map(
    ([name, { title: t, description: d, ...parameters }]) => ({
      type: 'function',
      function: { name, description: `${t}\n${d}`, parameters },
    })
  )
const execTools = async (toolCalls, threadId, runId) => {
  const { type, tool_calls } = toolCalls
  assert(Array.isArray(tool_calls), 'tool_calls is not an array')
  assert(type === 'tool_calls', `step type is ${type}`)
  assert(tool_calls.length, 'tool_calls is empty')

  // TODO standardize names for title and key
  const actions = schemaToFunctions(shell.api)

  const calls = tool_calls.map(async (call) => {
    const { id: tool_call_id, type, function: fn } = call
    assert.strictEqual(type, 'function')
    const { name, arguments: args } = fn
    let output
    try {
      const payload = JSON.parse(args)
      const action = actions[name](payload)
      const result = await interchain(action, '..')
      output = JSON.stringify(result, null, '  ')
    } catch (error) {
      error.stack =
        error.stack.split('\n').slice(0, 3).join('\n') + '\n(...truncated)'
      const string = serializeError(error, { maxDepth: 2 })
      output = 'ERROR!!\n' + JSON.stringify(string, null, '  ')
    }
    return { tool_call_id, output }
  })
  const tool_outputs = await Promise.all(calls)
  await useAsync(
    () => context.ai.submitToolOutputs(threadId, runId, { tool_outputs }),
    'key-submit-tool-outputs'
  )
}
const splat = (existing, next) => {
  const result = [...existing]
  for (const item of next) {
    const index = result.findIndex((e) => e.id === item.id)
    if (index !== -1) {
      result[index] = item
    } else {
      result.push(item)
    }
  }
  return result
}
const getLastStepId = (steps) => {
  let lastStepId
  for (const step of steps) {
    if (step.status === 'in_progress') {
      break
    }
    lastStepId = step.id
  }
  return lastStepId
}
const pollSteps = async (lastStepId, threadId, runId) =>
  useAsync(async () => {
    const result = {}
    while (!result.next?.length) {
      const run = await context.ai.runsRetrieve(threadId, runId)
      result.done = endings.includes(run.status)
      result.tools = !!run.required_action
      const steps = await context.ai.stepsList(threadId, runId, {
        limit: 100,
        order: 'asc',
        after: lastStepId,
      })
      result.next = steps.data

      // if message creation, and completed, then retrive the message by id
      result.next = result.next.map(async (step) => {
        const { type, step_details, status } = step
        if (type === 'message_creation' && status === 'completed') {
          assert(!step_details.message_creation.text, 'text is not empty')
          const { message_id } = step_details.message_creation
          const message = await context.ai.messagesRetrieve(
            threadId,
            message_id
          )
          const { content } = message
          assert(Array.isArray(content), 'content is not an array')
          assert(content.length === 1, `content length is ${content.length}`)
          const [
            {
              text: { value: text },
            },
          ] = content
          return merge({}, step, {
            step_details: { message_creation: { text } },
          })
        }
        return step
      })
      result.next = await Promise.all(result.next)

      if (result.done) {
        return result
      }
      if (!result.next.length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }
    return result
  }, 'key-run-step-list')

const updateSteps = async (rawSteps) => {
  // TODO tools could use the actual data from the chain to populate results
  assert(Array.isArray(rawSteps))
  const [state, setState] = await useState()
  const { messages = [] } = state

  const next = [...messages]
  const last = next.pop()
  assert(last.type === 'HAL', `last message is ${last.type}`)

  const steps = rawSteps.map((step, index) => {
    const { id, type, step_details } = step
    if (last.steps[index]) {
      assert.strictEqual(last.steps[index].id, id, `step id is ${id}`)
    }
    const { message_creation, tool_calls } = step_details
    const status =
      step.status === 'completed' ? STATUS.HAL.DONE : STATUS.HAL.THINKING
    if (message_creation) {
      const { text = '' } = message_creation // updated by us
      return { id, type: 'message', status, text }
    } else {
      const tools = tool_calls.map((call) => {
        const { id: callId, function: fn } = call
        let { name, arguments: args, output } = fn
        const transformed = { callId, cmd: name }
        if (args) {
          transformed.args = JSON.parse(args)
        }
        if (output) {
          if (output.startsWith('ERROR!!\n')) {
            output = output.slice('ERROR!!\n'.length)
            const error = JSON.parse(output)
            transformed.output = error
          } else {
            transformed.output = JSON.parse(output)
          }
        }
        return transformed
      })
      return { id, type: 'tools', status, tools }
    }
  })

  next.push({ ...last, steps })
  await setState({ messages: next })
}
const addUserMessage = async (text) => {
  const [state, setState] = await useState()
  const user = {
    type: 'USER',
    text,
    status: STATUS.USER.BOOTING,
  }
  await setState({ messages: [...state.messages, user] })
}
const addHalMessage = async () => {
  const [state, setState] = await useState()
  const HAL = {
    type: 'HAL',
    steps: [],
    status: STATUS.HAL.BOOTING,
  }
  await setState({ messages: [...state.messages, HAL] })
}
const updateMessageStatus = async (status) => {
  const [state, setState] = await useState()
  const { messages } = state
  assert(Array.isArray(messages))
  const next = [...messages]
  const last = next.pop()
  assert(last.type === 'USER' || last.type === 'HAL')
  next.push({ ...last, status })
  await setState({ messages: next })
}
const createAI = () => {
  const env = import.meta.env || process.env
  const { VITE_OPENAI_API_KEY, OPENAI_API_KEY } = env
  const apiKey = VITE_OPENAI_API_KEY || OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('missing openai api key')
  }
  const ai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const retryOptions = { forever: true, minTimeout: 500, maxTimeout: 3000 }
  const factory = (fn) => {
    assert(fn instanceof Function, `fn is not a function`)
    return (...args) => {
      let resolve, reject
      const promise = new Promise((r, j) => {
        resolve = r
        reject = j
      })
      const operation = retry.operation(retryOptions)
      operation.attempt(async () => {
        try {
          const result = await fn(...args)
          resolve(result)
        } catch (error) {
          console.error(error)
          if (operation.retry(error)) {
            return
          }
          reject(operation.mainError())
        }
      })
      return promise
    }
  }
  return {
    assistantsList: factory((...a) => ai.beta.assistants.list(...a)),
    assistantsUpdate: factory((...a) => ai.beta.assistants.update(...a)),
    assistantsCreate: factory((...a) => ai.beta.assistants.create(...a)),
    threadsCreate: factory((...a) => ai.beta.threads.create(...a)),
    messagesCreate: factory((...a) => ai.beta.threads.messages.create(...a)),
    messagesRetrieve: factory((...a) =>
      ai.beta.threads.messages.retrieve(...a)
    ),
    runsCreate: factory((...a) => ai.beta.threads.runs.create(...a)),
    runsRetrieve: factory((...a) => ai.beta.threads.runs.retrieve(...a)),
    submitToolOutputs: factory((...a) =>
      ai.beta.threads.runs.submitToolOutputs(...a)
    ),
    stepsList: factory((...a) => ai.beta.threads.runs.steps.list(...a)),
  }
}
