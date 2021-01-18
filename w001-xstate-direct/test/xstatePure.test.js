const assert = require('assert')
const debug = require('debug')('interblock:tests:xstatePure')
const { interpret, Machine, assign } = require('xstate')
require('debug').enable('*xstatePure')

const definition = {
  initial: 'idle',
  strict: true,
  context: {
    answer: 0,
  },
  states: {
    idle: { on: { TICK: 'asyncCall' } },
    asyncCall: {
      invoke: { src: 'asyncCall', onDone: 'process' },
    },
    process: {
      entry: 'assignAnswer',
      always: [
        { target: 'obfuscate', cond: 'isAnswerCorrect' },
        { target: 'done' },
      ],
    },
    obfuscate: {
      exit: 'assignObfuscation',
      always: 'done',
    },
    done: {
      type: 'final',
      data: ({ answer }) => answer,
    },
  },
}
const config = {
  actions: {
    assignAnswer: assign({
      answer: ({ answer }, event) => {
        assert.strictEqual(answer, 0)
        return event.data
      },
    }),
    assignObfuscation: assign({
      answer: () => 7,
    }),
  },
  guards: {
    isAnswerCorrect: ({ answer }, event) => {
      return answer === 42
    },
  },
  services: {
    asyncCall: async ({ answer }) => {
      await Promise.resolve()
      return 42
    },
  },
}

describe('baseline', () => {
  test('loop with awaits comparison', async () => {
    const machine = Machine(definition, config)
    const service = interpret(machine)
    service.start()
    const done = new Promise((resolve) => {
      service.onDone((result) => {
        resolve(result)
      })
    })
    service.send('TICK')
    const result = await done
    debug(result)
    assert.strictEqual(result.data, 7)

    // make a machine that does an async operation, then does an if statement
    // run the direct comparison as raw action
    // run these thru benchmark to get idea for speed
    // view results in profiler

    // start building a bare xstate that aims to be pure state interpretation
    // build upon this to make more advanced xstate, as a machine, to capture all the checks and nuances

    // insert the advanced logging functions, and stepping functions
  })
  test('pure xstate', async () => {
    const result = await pure('TICK', definition, config)
    debug(`result: `, result)
  })
})

const pure = async (event, definition, config = {}) => {
  // exhaust the machine, return the end result
  // make a recursive call to handle nested states
  let context = config.context || {}
  // keep looping until no more actions left ?
}
