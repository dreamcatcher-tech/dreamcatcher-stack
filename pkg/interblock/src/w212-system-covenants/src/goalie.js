import OpenAI from 'openai'
import { serializeError } from 'serialize-error'
import posix from 'path-browserify'
import { interchain, useState, Request } from '../../w002-api'
import Debug from 'debug'
const debug = Debug('interblock:apps:threads')

const schema = {
  // the schema for the whole state
  type: 'object',
  title: 'The Goalie',
  description: `The Goalie is a goal management system for the AI
        It works as follows:
            1. It receives the user prompt, in context of the entire interaction
            2. Then i determines which goal the user is currently working on, or if they are starting a new goal
            3. Also it determines if the user is done with any current goals, and if so, closes them
            4. Finally it reprioritizes the goals based on the latest prompt
            5. Control is then passed back to HAL, with HALs context isolated to be the current goal only
    `,
  additionalProperties: false,
  properties: {
    allGoalIdsPrioritized: {
      type: 'array',
      description: `An array of all the goalIds in the order they should be in.
      The goalIds are the names of the children of this object, and are integers.`,
      items: { type: 'integer' },
    },
  },
}

// a goal contains the thread of the progress towards that goal so far
// the goals might be in a map, which favours bucketing
// or the map might be in the state, so it presented clearer

const properties = {
  titles: {
    type: 'array',
    minItems: 1,
    uniqueItems: true,
    items: {
      type: 'string',
      description: `Each title of the goal, which should be as short as possible.  Good examples are: 'Add Customer', 'Check Email', 'Get Weather', 'Find Ungeocoded Customers`,
      maxLength: 30,
    },
    description: `An array of titles of increasingly granularity that
    describe this goal.  The first title should be the most general, and
    the last title should be the most specific`,
  },
  summary: {
    type: 'string',
    description: `The description of the goal which allows for richer information that just what is in the title array`,
    maxLength: 50,
  },
}
const rmReasons = {
  COMPLETED: 'completed',
  IRRELEVANT: 'irrelevant',
  FAILED: 'failed',
}

const api = {
  add: {
    type: 'object',
    title: 'ADD_GOAL',
    description: `Add a new goal that has been detected from the users input.
    Returns the list of all goals in priority order, with the newly created goal at index zero, which represents the top priority goal`,
    additionalProperties: false,
    required: ['titles', 'summary'],
    properties,
  },
  update: {
    type: 'object',
    title: 'UPDATE_GOAL',
    description: `Update an existing goal AI based on the latest prompt`,
    additionalProperties: false,
    required: ['goalId', 'titles', 'summary'],
    properties: { goalId: { type: 'integer' }, ...properties },
  },
  rm: {
    type: 'object',
    title: 'RM_GOAL',
    description: `Close a goal from the AI.  Returns the list of all remaining goals in priority order, with the highest priority at index 0`,
    additionalProperties: false,
    required: ['goalId', 'reason'],
    properties: {
      goalId: {
        type: 'integer',
        description: `The id of the goal to remove`,
      },
      reason: {
        enum: Object.values(rmReasons),
        description: `The reason the goal is being closed.  This can be 'completed', 'irrelevant', or 'failed'`,
      },
    },
  },
  prioritize: {
    type: 'object',
    title: 'PRIORITIZE',
    description: `Reorder the goals in the AI.  Returns the list of all goals in priority order, with the highest priority at index 0`,
    additionalProperties: false,
    required: ['goalIds'],
    properties: {
      goalIds: {
        type: 'array',
        description: `An array of the goal ids where the first index in the array is the highest priority.  Only the supplied goal ids will be reordered, so if you want to move a goal to the top, only a single goalId is required`,
        items: { type: 'integer' },
        minItems: 1,
      },
    },
  },
}

const reducer = async (request) => {
  debug('request', request)
  switch (request.type) {
    case 'ADD_GOAL': {
      const { titles, summary } = request.payload
      const basename = undefined
      const spawnAction = Request.createSpawn(basename, {
        state: { titles, summary },
      })
      const { alias } = await interchain(spawnAction)
      const goalId = parseInt(alias)
      const [{ allGoalIdsPrioritized }, setState] = await useState()
      const newOrder = [goalId, ...allGoalIdsPrioritized]
      await setState({ allGoalIdsPrioritized: newOrder })
      return { success: true, goalId, allGoalIdsPrioritized: newOrder }
    }
    case 'PRIORITIZE': {
      const { goalIds } = request.payload
      const [{ allGoalIdsPrioritized }, setState] = await useState()
      const existing = new Set(allGoalIdsPrioritized)
      const newOrder = []
      for (const goalId of goalIds) {
        if (!existing.has(goalId)) {
          throw new Error(`goalId ${goalId} not found in order`)
        }
        existing.delete(goalId)
        newOrder.push(goalId)
      }
      newOrder.push(...existing)
      await setState({ allGoalIdsPrioritized: newOrder })
      return { allGoalIdsPrioritized: newOrder }
    }
    case 'RM_GOAL': {
      const { goalId, reason } = request.payload
      const [{ allGoalIdsPrioritized }, setState] = await useState()
      const existing = new Set(allGoalIdsPrioritized)
      if (!existing.has(goalId)) {
        throw new Error(`goalId ${goalId} not found in order`)
      }
      existing.delete(goalId)
      const newOrder = [...existing]
      const [, setGoalState] = await useState(goalId.toString())
      // TODO dispatch the reasoning to the child first
      // await setGoalState({ reason })
      const rm = Request.createRemoveActor(goalId.toString())
      await interchain(rm)
      await setState({ allGoalIdsPrioritized: newOrder })
      return { allGoalIdsPrioritized: newOrder }
    }
    case 'UPDATE_GOAL': {
      const { goalId, titles, summary } = request.payload
      const [{ allGoalIdsPrioritized }] = await useState()
      if (!allGoalIdsPrioritized.includes(goalId)) {
        throw new Error(`goalId ${goalId} not found in order`)
      }
      const [, setState] = await useState(goalId.toString())
      return setState({ titles, summary })
    }
    case '@@INIT': {
      return
    }
    default:
      throw new Error(`unknown request ${request.type}`)
  }
}

const name = 'goalie'
const installer = {
  schema,
  state: { allGoalIdsPrioritized: [] },
  ai: {
    name: 'GPT4',
    assistant: {
      model: 'gpt-4-1106-preview',
      instructions: `
        Figure out what the user wants to do.
        You can only call functions, never anything else.
        Your text messages will be completely discarded, so don't bother talking.

        If you're not sure, create a new goal named 'no idea 🤷'
      `,
    },
  },
}

export { name, api, reducer, installer, rmReasons }
