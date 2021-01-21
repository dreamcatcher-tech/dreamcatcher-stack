const assert = require('assert')
const debug = require('debug')('interblock:tests:xstatePure')
const { interpret, Machine, assign } = require('xstate')
require('debug').enable('')
const { pure } = require('..')
const definition = {
  initial: 'idle',
  strict: true,
  context: {
    answer: 0,
  },
  states: {
    idle: {
      entry: 'hello',
      on: { TICK: 'asyncCall', ERROR: 'errorAsyncCall' },
    },
    asyncCall: {
      invoke: { src: 'asyncCall', onDone: 'process' },
    },
    errorAsyncCall: {
      invoke: {
        src: 'asyncCall',
        onDone: 'process',
        onError: { target: 'process', actions: 'logError' },
      },
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
      always: 'nested',
    },
    nested: {
      entry: 'nestedEntry',
      initial: 'inner',
      states: {
        inner: {
          always: 'final',
        },
        final: { type: 'final' },
      },
      onDone: 'done',
    },
    done: {
      type: 'final',
      data: (context, event) => {
        debug(`done data: context: %O event %O`, context, event)
        return context.answer
      },
    },
  },
}
const config = {
  actions: {
    hello: (context, event) => debug(`actions.hello(%o,%o)`, context, event),
    assignAnswer: assign({
      answer: (context, event) => {
        debug(`assignAnswer: `, context, event)
        const { answer } = context
        assert.strictEqual(answer, 0)
        return event.data
      },
    }),
    assignObfuscation: assign({
      answer: () => 7,
    }),
    nestedEntry: () => debug(`nestedEntry`),
  },
  guards: {
    isAnswerCorrect: ({ answer }, event) => {
      return answer === 42
    },
  },
  services: {
    asyncCall: async (context, event) => {
      debug(`asyncCall: `, context, event)
      return await Promise.resolve(42)
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
    debug('')
    debug('')
    debug('')
    debug('')
    const result = await pure('TICK', definition, config)
    debug(`test result: `, result)
    assert.strictEqual(result, 7)
  })
})
