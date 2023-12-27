/**
 * This is the thread management system for the AI.
 */
import Debug from 'debug'
import posix from 'path-browserify'
import { toGpt4, transformToGpt4Api } from '../../w002-api'
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
const forwardedMessageTypes = ['USER', 'GOALIE', 'RUNNER', 'TOOL']
const status = { enum: ['RUNNING', 'DONE', 'ERROR'] }

const goaliePrompt = {
  role: 'system',
  content: `You are an expert at goal detection.  Keep your replies to less than 160 characters.  You may use emoji which does not count against the 160 character limit of your responses. 
  
  Tackling the users requests one at a time, your job is to figure out what the user wants to do enough to call the stuckloop function.  The stuckloop function will then provide you with the instructions to complete the task.  The answers are arranged in an FAQ style format so think of calling the stuckloop like making a search query in stackoverflow.

  The query should be generic and not include any specific nouns - remember you are searching the public internet for instructions with this call.

  If you are not clear on how to structure this query, ask clarifying questions until you are confident in making the stuckloop call.
  `,
}

const model = 'gpt-4-1106-preview'
const key = {
  type: 'string',
  description: `unique key for this request to allow side band access to streaming data`,
}
const user = {
  type: 'object',
  title: 'User',
  description: `Text input from the user to the AI system.`,
  additionalProperties: false,
  required: ['type', 'text'],
  properties: {
    type: { const: 'USER' },
    text: { type: 'string', description: `The text input from the user` },
    status,
    key,
  },
}
const goalie = {
  type: 'object',
  title: 'Goalie',
  description: `Text responses back from the Goalie to the user.  If the goal needs clarification, the Goalie will ask the user for more information.  Once the goal is clear, the Goalie will call the stuckloop function to get the instructions to complete the task.  This will result in a 'goal' message being generated.`,
  additionalProperties: false,
  required: ['type', 'text'],
  properties: {
    type: { const: 'GOALIE' },
    text: { type: 'string', description: `The text of the goalie` },
    status,
    key,
  },
}
const help = {
  title: 'Help',
  description: `The help is the instructions to complete a task.`,
  type: 'object',
  required: ['type', 'instructions', 'done', 'tld', 'cmds'],
  properties: {
    type: {
      description: `The format of the help, which allows the system to parse the help effectively`,
      enum: ['Artifact'],
    },
    targets: {
      type: 'array',
      description: `The goals that this help targets`,
      items: {
        type: 'string',
        description: `A goal that this help targets`,
      },
    },
    instructions: {
      type: 'string',
      description: `The instructions to meet the goal`,
    },
    done: {
      type: 'string',
      description: `The condition to check when done`,
    },
    tld: {
      type: 'string',
      description: `The top level directory to start in`,
    },
    cmds: {
      type: 'array',
      description: `The commands needed to complete the goal`,
      items: {
        type: 'string',
        description: `The command to run`,
      },
    },
  },
}

const goal = {
  type: 'object',
  title: 'Goal',
  description: `The goal is the current task that the user is trying to accomplish.  The goal is used to search the help system for instructions on how to accomplish the task.`,
  additionalProperties: false,
  required: ['type', 'text', 'helps'],
  properties: {
    type: { const: 'GOAL' },
    text: { type: 'string', description: `The text of the goal` },
    status,
    key,
    helps: {
      type: 'array',
      description: `The helps that were recovered from the goal space search, in relevance order.`,
      items: help,
    },
  },
}

const runner = {
  type: 'object',
  title: 'Runner',
  description: `Text replies back to the user from the AI that is executing the current help.  These can be updates or they can be questions.`,
  additionalProperties: false,
  required: ['type', 'text'],
  properties: {
    type: { const: 'RUNNER' },
    text: { type: 'string', description: `The text of the runner` },
    status,
  },
}

// TODO could an AI call be modelled as a special type of tool call ?
// TODO should we handle progress updates on the tool call ?
const tool = {
  type: 'object',
  title: 'Tool',
  description: `A tool is a single function that can be called to accomplish a task.`,
  additionalProperties: false,
  required: ['type', 'cmd', 'args', 'output'],
  properties: {
    type: { const: 'TOOL' },
    status,
    id: { type: 'string', description: `The id of the tool call` },
    cmd: {
      type: 'string',
      description: `The command to run`,
    },
    schema: {
      type: 'object',
      description: `The schema for the arguments to the command`,
    },
    args: {
      type: 'object',
      description: `The arguments to pass to the command`,
    },
    output: {
      type: 'object',
      description: `The output of the command`,
    },
    consequences: {
      type: 'object',
      description: `The consequences of running the command, so we can see all the Pulses that resulted from this particular action being called, and also the diffs on any state that was changed so the user can see what was altered.`,
    },
  },
}

const schema = {
  // the schema for the whole HAL state
  type: 'object',
  title: 'Threads',
  description: `HAL is the executing AI.  It is the junction point between artifact and AI activity.  HAL is a combination of two AIs, the Goalie and the Runner.  The Goalie is the AI that is responsible for detecting the goal of the user.  The Runner is the AI that is responsible for executing the instructions retrieved by the Goalie to complete the goal detected by the Goalie from the user prompts.`,
  additionalProperties: false,
  required: ['messages', 'mode'],
  properties: {
    messages: {
      type: 'array',
      description: `The messages between the user and HAL`,
      items: { anyOf: [user, goalie, goal, runner, tool] },
    },
    mode: {
      type: 'string',
      description: `The current mode of the AI`,
      enum: ['GOALIE', 'RUNNER'],
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
    required: ['text'],
    properties: {
      text: { type: 'string' },
      key: {
        type: 'string',
        description: `unique key for this request to allow side band access to streaming data`,
      },
    },
  },
}
const context = {}

// TODO somehow put a check in to see if we have enough helps to proceed
// proceeding can be in parallel

// TODO check if the current chat has the info we might need
// pull apart the history to see if anything was on the current goal
// suggest things that were said before, like a partial form filling function

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'PROMPT': {
      const { text } = request.payload
      const [{ messages, mode }, setState] = await useState()
      const message = { type: 'USER', text }
      await setState({ messages: [...messages, message] })
      await interchain(mode)
      return
    }
    case 'GOALIE': {
      await invokeGoalie()
      return
    }
    case 'RUNNER': {
      await invokeRunner()
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

const invokeGoalie = async () => {
  const [{ messages, mode }, setState] = await useState()
  assert(mode === 'GOALIE', `mode must be GOALIE ${mode}`)
  const { api, functions } = await useApi('stucks')
  const tools = transformToGpt4Api(api)
  const { content, toolCalls } = await useAsync(async () => {
    const streamCall = await context.ai.chat.completions.create({
      model,
      temperature: 0,
      messages: [...transformMessages(messages), goaliePrompt],
      stream: true,
      seed: 1337,
      tools,
    })
    const accumulator = []
    for await (const part of streamCall) {
      const content = part.choices[0]?.delta?.content || ''
      const toolCalls = part.choices[0]?.delta?.tool_calls || []
      if (content) {
        debug('content', content)
      }
      accumulator.push({ content, toolCalls })
    }
    const result = accumulate(accumulator)
    debug('result', result)
    return result
  })
  if (content) {
    const message = { type: 'GOALIE', text: content }
    await setState({ messages: [...messages, message] })
  } else {
    assert(toolCalls.length, 'Must have at least one tool call')
    // TODO store the goals, if multiple ones, and come back to them
    const toolCall = toolCalls[0].function
    assert(toolCall.name === 'help', 'only help supported')
    const { helps } = await functions[toolCall.name](toolCall.arguments)
    // TODO handle no helps founds
    assert(helps.length, 'Must have at least one help')
    const text = toolCall.arguments.goal
    assert(typeof text === 'string', `text must be a string: ${text}`)
    const [{ messages }, setState] = await useState()
    const message = { type: 'GOAL', text, helps }
    await setState({ messages: [...messages, message], mode: 'RUNNER' })
    await interchain('RUNNER')
  }
}
const transformMessages = (messages) => {
  const transformed = []
  for (const message of messages) {
    if (!forwardedMessageTypes.includes(message.type)) {
      continue
    }
    // const message = { role: 'tool', content, tool_call_id: toolCall.id }
    const { text, type } = message
    if (type === 'USER') {
      transformed.push({ role: 'user', content: text })
    } else if (type === 'GOALIE') {
      transformed.push({ role: 'assistant', name: 'goalie', content: text })
    } else if (type === 'RUNNER') {
      transformed.push({ role: 'assistant', name: 'runner', content: text })
    } else if (type === 'TOOL') {
      const name = slugify(message.cmd)
      transformed.push({
        role: 'assistant',
        name: 'runner',
        // TODO handle concurrent tool calls as a single tool call
        tool_calls: [
          {
            id: message.id,
            type: 'function',
            function: { name, arguments: JSON.stringify(message.args) },
          },
        ],
      })
      if (message.output) {
        transformed.push({
          role: 'tool',
          content: JSON.stringify(message.output),
          tool_call_id: message.id,
        })
      }
    } else {
      throw new Error(`unknown message type: ${type}`)
    }
  }
  return transformed
}

const invokeRunner = async () => {
  const [{ messages, mode }, setState] = await useState()
  assert(mode === 'RUNNER', `mode must be RUNNER ${mode}`)
  // TODO check we actually asked for something back in
  const goal = getLastGoal(messages)

  // TODO handle multiple goals coming back
  const help = goal.helps[0]
  const { tld } = help
  await ensureTld(tld)

  const { content, toolCalls, functions } = await aiRunner(help)

  if (content) {
    const message = { type: 'RUNNER', text: content, status: STATUS.DONE }
    await setState({ messages: [...messages, message] })
  } else {
    // would expect these to have been partially fulfilled inside aiRunner
    assert(toolCalls.length, 'Must have at least one tool call')
    console.log('toolCalls', toolCalls[0])
    await addToolMessages(toolCalls, functions)

    await Promise.all(
      toolCalls.map(async (toolCall) => {
        const { name, arguments: args } = toolCall.function
        assert(typeof name === 'string', `name must be a string: ${name}`)
        assert(typeof args === 'object', `args must be an object: ${args}`)
        const func = functions[name]
        assert(func, `unknown function: ${name}`)
        // TODO handle rejections
        const result = await func(args)
        await updateToolMessage(toolCall.id, result)
        console.log('result', result)
      })
    )
    await interchain('RUNNER')
  }
}

const updateToolMessage = async (id, output) => {
  const [{ messages }, setState] = await useState()
  assert(messages.some((m) => m.id === id))
  const nextMessages = messages.map((message) => {
    if (message.id === id) {
      return { ...message, output, status: STATUS.DONE }
    }
    return message
  })
  await setState({ messages: nextMessages })
}

const addToolMessages = async (toolCalls, functions) => {
  const [{ messages }, setState] = await useState()
  const toolMessages = toolCalls.map((toolCall) => {
    const { id } = toolCall
    assert(typeof id === 'string', `id must be a string: ${id}`)
    const { name, arguments: args } = toolCall.function
    assert(typeof name === 'string', `name must be a string: ${name}`)
    assert(typeof args === 'object', `args must be an object: ${args}`)
    const { cmd } = functions[name]
    assert(typeof cmd === 'string', `unknown function: ${name}`)
    return { type: 'TOOL', status: STATUS.RUNNING, id, cmd, args, output: {} }
  })
  await setState({ messages: [...messages, ...toolMessages] })
}

const getLastGoal = (messages) => {
  assert(Array.isArray(messages), `messages must be an array: ${messages}`)
  const goal = messages.findLast((message) => message.type === 'GOAL')
  assert(goal, `Must have a goal: ${messages}`)
  return goal
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

const getRunnerPrompt = (state, help) => {
  const { instructions, tld, done, cmds } = help
  return {
    role: 'system',
    content: `You are a CLI and an expert in following instructions from the help system. You must converse with your user to get any parameters you need keeping your reply length to a minimum.  
    
    The help system instructions are: ${instructions}

    You will be starting in the directory path: ${tld}

    Which has the state object of: ${JSON.stringify(state, null, 2)}
    
    The commands you will need to use are: ${cmds.join(', ')}
    
    Once done, check that the done condition is met: ${done}
    
    Once done, call the cmd 'done'.
    
    If you cannot proceed, call the cmd 'error'.
    
    If you think the information the user has given you in response to one of your questions is not related to the current goal, call the cmd 'dunno'.
    `,
  }
}

const aiRunner = async (help) => {
  const { cmds, tld } = help
  const [state] = await useState(tld)
  const [{ messages }] = await useState()
  const runnerPrompt = getRunnerPrompt(state, help)

  const { functions, tools } = await populateTools(cmds)

  // TODO fix this workaround once schema is first class
  const formData = state.template.schema
  tools[1] = merge({}, tools[1], {
    function: { parameters: formData },
  })
  delete tools[1].function.parameters.properties.formData
  delete tools[1].function.parameters.properties.network

  const { content, toolCalls } = await useAsync(async () => {
    const streamCall = await context.ai.chat.completions.create({
      model,
      temperature: 0,
      messages: [...transformMessages(messages), runnerPrompt],
      stream: true,
      seed: 1337,
      tools,
    })
    const accumulator = []
    for await (const part of streamCall) {
      const content = part.choices[0]?.delta?.content || ''
      const toolCalls = part.choices[0]?.delta?.tool_calls || []
      if (content) {
        debug('content', content)
      }
      accumulator.push({ content, toolCalls })
    }
    const result = accumulate(accumulator)
    debug('result', result)
    return result
  })
  return { content, toolCalls, functions }
}
const populateTools = async (cmds) => {
  // loop thru the commands and pull in a command representing each one
  // then pass back the way to call these as well, since we need to executef
  const functions = {}
  const tools = await Promise.all(
    cmds.map(async (cmd) => {
      assert(posix.isAbsolute(cmd), `cmd must be absolute: ${cmd}`)
      const path = posix.dirname(cmd)
      let { api, functions: _functions } = await useApi(path)
      const name = posix.basename(cmd)
      const slug = slugify(cmd)
      functions[slug] = _functions[name]
      functions[slug].cmd = cmd
      return toGpt4(slug, cmd, api[name])
    })
  )
  return { functions, tools }
}
const slugify = (cmd) => {
  assert(typeof cmd === 'string', `cmd must be a string: ${cmd}`)
  assert(cmd, `cmd must be non-empty: ${cmd}`)
  return cmd.replace(/\//g, '_')
}
const ensureTld = async (tld) => {
  const [{ messages }] = await useState()
  const last = messages[messages.length - 1]
  if (last.type !== 'RUNNER' && last.type !== 'TOOL') {
    const shell = await useApi('/')
    await shell.functions.cd({ path: tld })
  }
}

const name = 'hal'
const installer = {
  state: { messages: [], mode: 'GOALIE' },
  config: { isPierced: true },
  schema,
}
export const STATUS = { RUNNING: 'RUNNING', DONE: 'DONE', ERROR: 'ERROR' }
export { name, api, reducer, installer }
