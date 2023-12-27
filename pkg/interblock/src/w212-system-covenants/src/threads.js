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
import { isBrowser } from 'wherearewe'
import { makeBook } from './book-maker'
import {
  interchain,
  useAsync,
  useAI,
  useApi,
  useState,
  transformToGpt4Api,
} from '../../w002-api'
import { shell } from '..'
import merge from 'lodash.merge'
import process from 'process'
import assert from 'assert-fast'
import retry from 'retry'
import yaml from 'js-yaml'
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
    properties: {
      text: { type: 'string' },
      maxFunctionCalls: {
        type: 'integer',
        description: `Throw an exception if more than this number of function calls are attempted`,
        minimum: 0,
      },
    },
  },
  function: {
    type: 'object',
    title: 'FUNCTION',
    description:
      'Will return after the first successful function call to the AI.  Will remind the AI that it must call a function if it tries to speak before successfully calling a function.',
    additionalProperties: false,
    required: ['name'],
    properties: {
      name: { type: 'string' },
    },
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
  GOALIE: {
    BOOTING: 'BOOTING',
    THINKING: 'THINKING',
    DONE: 'DONE',
  },
}

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

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'FUNCTION': {
      throw new Error('not implemented')
    }
    case 'UPSERT_ASSISTANT': {
      // TODO make an api extractor function that gets out the params and checks
      // payload is passed in, schema checked against api, and params returned
      let [{ path, assistantId }, setState] = await useState()
      const { api } = await useApi(path)

      let { assistant } = defaultAI

      if (path !== '(default)') {
        const [ai] = await useAI(path)
        if (ai) {
          assert(ai.name === 'GPT4', `ai name is ${ai.name}`)
          assistant = ai.assistant
        }
      }
      if (!assistantId) {
        // see if there is an assistant with this name
        const assistants = await useAsync(async () => {
          const params = { order: 'desc', limit: '100' }
          const list = await context.ai.assistantsList(params)
          // TODO loop if more than 100 assistants
          return list.data
        })
        let remote = assistants.find((a) => a.name === path)

        if (remote) {
          await useAsync(async () => {
            await context.ai.assistantsDelete(remote.id)
          })
          remote = undefined
        }

        if (remote) {
          debug('assistant', remote.id, remote.name)
          assistantId = remote.id
          await setState({ assistantId })

          // TODO add a special synthetic call to query another bot
        } else {
          debug('creating assistant', path)
          // create the assistant
          await updateMessageStatus(STATUS.USER.CREATING)
          const tools = transformToGpt4Api(api)
          const book = await makeBook(path)

          const bookString = yaml.dump(book)
          const glue = `\n
          The text that follows is in yaml format and contains a map of the entire filesystem tree, with each node having the following keys: api, children, state, and schema.  To access a path in this filesystem you need to use the 'cd' command and then stop immediately, whereupon the next run the functions in the api key will become available to you.  The state at that point is in the 'state' key, and the schema for that state including a description about what that object does is in the 'schema' key. 

          For example, if Dave wants to talk about customers, quite likely he wants to be using the app at /apps/crm and more specifically the /apps/crm/customers chain.  To get there, issue a 'cd /apps/crm/customers' command then stop.  The next run will have the functions available to you.
          
          Remember: if you do not immediately stop execution after calling the cd function, the universe will end.

          The yaml:\n`
          debug('book created length', bookString.length)

          remote = await useAsync(async () => {
            const { model, instructions } = assistant
            debug('instructions', instructions.length)
            const result = await context.ai.assistantsCreate({
              name: path,
              model,
              // tools,
              instructions: instructions + glue + bookString,
            })

            return result
          })
          assistantId = remote.id
          await setState({ assistantId })
        }
      } else {
        // check that the assistant is still valid
        // throw new Error('TODO')
      }
      return
    }
    case 'UPSERT_THREAD': {
      let [{ threadId }, setState] = await useState()
      await updateMessageStatus(STATUS.USER.THREADING)
      if (!threadId) {
        // create the thread and set the ID
        threadId = await useAsync(async () => {
          const thread = await context.ai.threadsCreate()
          // TODO add metadata for the root chainId, path, and thread pulseId
          debug('create thread', thread)
          return thread.id
        })
        debug('threadId', threadId)
        await setState({ threadId })
      } else {
        // check the thread has the assistant set
        // check the thread data matches what we have on chain
      }

      return
    }
    case 'ADD_MESSAGE': {
      const { text } = request.payload
      await updateMessageStatus(STATUS.USER.MESSAGING)
      const [{ threadId }] = await useState()
      const messageId = await useAsync(async () => {
        const result = await context.ai.messagesCreate(threadId, {
          role: 'user',
          content: text,
        })
        debug('message', result.thread_id, result.id)
        return result.id
      })
      debug('messageId', messageId)
      await updateMessageStatus(STATUS.USER.DONE)
      return
    }
    case 'RUN': {
      const [{ threadId, assistantId, path }] = await useState()
      const [{ wd }] = await useState(path)
      const { api, functions } = await useApi(wd)
      const tools = transformToGpt4Api(api)
      const runId = await useAsync(async () => {
        const result = await context.ai.runsCreate(threadId, {
          assistant_id: assistantId,
          tools,
          instructions: `never ever generate any details unless explicitly told to do so as this is a production environment`,
        })
        return result.id
      })
      // trouble is you can't CD and then insert more tools.
      // so CD needs to be the end of the run, like a function call that ends
      // when we detect it we can submit tool outputs, but we will cancel
      // immediately afterwards.
      await updateMessageStatus(STATUS.HAL.THINKING)

      debug('runId', runId)

      // run step status: in_progress, cancelled, failed, completed, expired
      let steps = []
      let isRunComplete = false
      let callsRemaining = request.payload.maxFunctionCalls
      if (!Number.isInteger(callsRemaining)) {
        callsRemaining = Number.MAX_SAFE_INTEGER
      }
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
          const toolOutputs = await execTools(
            functions,
            last.step_details,
            callsRemaining
          )
          callsRemaining -= toolOutputs.length
          await sendOutputs(toolOutputs, threadId, runId)
          await updateMessageStatus(STATUS.HAL.THINKING)
        }
      } while (!isRunComplete)
      await updateMessageStatus(STATUS.HAL.DONE)
      return
    }
    case 'USER': {
      await addUserMessage(request.payload.text)
      await interchain('UPSERT_ASSISTANT')
      await interchain('UPSERT_THREAD')
      let [{ threadId, assistantId, messages }, setState] = await useState()
      assert(assistantId, 'assistantId is missing')
      assert(threadId, 'threadId is missing')

      await interchain('ADD_MESSAGE', request.payload)

      const url = `https://platform.openai.com/playground?assistant=${assistantId}&mode=assistant&thread=${threadId}`
      debug('url', url)

      // TODO block concurrent runs occuring
      await addHalMessage()
      await interchain('RUN', request.payload)
      const [{ messages: newMessages }] = await useState()
      return newMessages.slice(messages.length)
    }
    case '@@INIT': {
      let { path } = request.payload.installer.state
      assert(posix.isAbsolute(path), `must have absolute path: ${path}`)
      let [ai] = await useAI(path)
      if (!ai) {
        ai = defaultAI
        path = '(default)'
      }
      const { name, assistant } = ai
      assert.strictEqual(name, 'GPT4', `ai name is ${name}`)
      assert(assistant instanceof Object)
      assert(assistant.instructions, 'instructions is missing')
      assert(assistant.model, 'model is missing')

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

const sendOutputs = async (tool_outputs, threadId, runId) => {
  await useAsync(() =>
    context.ai.submitToolOutputs(threadId, runId, { tool_outputs })
  )
}
const execTools = async (functions, toolCalls, callsRemaining) => {
  const { type, tool_calls } = toolCalls
  assert(Array.isArray(tool_calls), 'tool_calls is not an array')
  assert(type === 'tool_calls', `step type is ${type}`)
  assert(tool_calls.length, 'tool_calls is empty')
  debug('tool_calls', tool_calls)
  // TODO standardize names for title and key

  if (callsRemaining < tool_calls.length) {
    throw new Error(`too many function calls`)
  }

  const calls = tool_calls.map(async (call) => {
    const { id: tool_call_id, type, function: fn } = call
    assert.strictEqual(type, 'function')
    const { name, arguments: args } = fn
    let output
    try {
      const payload = JSON.parse(args)
      const result = await functions[name](payload)
      output = JSON.stringify(result, null, '  ')
    } catch (error) {
      delete error.stack
      const string = serializeError(error, { maxDepth: 2 })
      output = JSON.stringify(string, null, '  ')
    }
    return { tool_call_id, output }
  })
  const toolOutputs = await Promise.all(calls)
  return toolOutputs
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
  })

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
          transformed.output = JSON.parse(output)
        }
        return transformed
      })
      return { id, type: 'tools', status, tools }
    }
  })

  next.push({ ...last, steps })
  await setState({ messages: next })
}
export const addUserMessage = async (text) => {
  const [state, setState] = await useState()
  const user = {
    type: 'USER',
    text,
    status: STATUS.USER.BOOTING,
  }
  await setState({ messages: [...state.messages, user] })
}
export const addHalMessage = async () => {
  const [state, setState] = await useState()
  const HAL = {
    type: 'HAL',
    steps: [],
    status: STATUS.HAL.BOOTING,
  }
  await setState({ messages: [...state.messages, HAL] })
}
export const addGoalieMessage = async () => {
  const [state, setState] = await useState()
  const goalie = {
    type: 'GOALIE',
    titles: [],
    summary: '',
    status: STATUS.GOALIE.BOOTING,
  }
  await setState({ messages: [...state.messages, goalie] })
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

  const retryOptions = { forever: false, minTimeout: 500, maxTimeout: 3000 }
  const factory = (fn, name) => {
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
          const result = await new Promise((resolve, reject) => {
            const timeout = 10000
            const error = new Error(`OpenAI timeout after ${timeout}ms`)
            const id = setTimeout(() => reject(error), 10000)
            if (isBrowser) {
              console.log('OpenAI', name + '\t', ...args)
            }
            fn(...args).then((result) => {
              clearTimeout(id)
              resolve(result)
            }, reject)
          })
          resolve(result)
        } catch (error) {
          console.error(error.message)
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
    assistantsList: factory(
      (...a) => ai.beta.assistants.list(...a),
      'assistantsList   '
    ),
    assistantsUpdate: factory(
      (...a) => ai.beta.assistants.update(...a),
      'assistantsUpdate '
    ),
    assistantsCreate: factory(
      (...a) => ai.beta.assistants.create(...a),
      'assistantsCreate '
    ),
    assistantsDelete: factory(
      (...a) => ai.beta.assistants.del(...a),
      'assistantsDelete '
    ),
    threadsCreate: factory(
      (...a) => ai.beta.threads.create(...a),
      'threadsCreate    '
    ),
    messagesCreate: factory(
      (...a) => ai.beta.threads.messages.create(...a),
      'messagesCreate   '
    ),
    messagesRetrieve: factory(
      (...a) => ai.beta.threads.messages.retrieve(...a),
      'messagesRetrieve '
    ),
    runsCreate: factory(
      (...a) => ai.beta.threads.runs.create(...a),
      'runsCreate       '
    ),
    runsCancel: factory(
      (...a) => ai.beta.threads.runs.cancel(...a),
      'runsCancel       '
    ),
    runsRetrieve: factory(
      (...a) => ai.beta.threads.runs.retrieve(...a),
      'runsRetrieve     '
    ),
    submitToolOutputs: factory(
      (...a) => ai.beta.threads.runs.submitToolOutputs(...a),
      'submitToolOutputs'
    ),
    stepsList: factory(
      (...a) => ai.beta.threads.runs.steps.list(...a),
      'stepsList        '
    ),
  }
}

const name = 'threads'
const installer = {
  state: { threadId: null, assistantId: null },
  config: { isPierced: true },
  schema,
}
export { name, api, reducer, installer, schema, STATUS }

const injectedResponses = []
export function injectResponses(...responses) {
  injectedResponses.push(...responses)
}
