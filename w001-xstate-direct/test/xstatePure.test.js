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
    idle: {
      entry: 'hello',
      on: { TICK: 'asyncCall' },
    },
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

const pure = async (event, definition, config = {}) => {
  assert.strictEqual(typeof config, 'object')
  if (typeof event === 'string') {
    event = { type: event }
  }
  // TODO validate machine against xstate, then cache the result
  // TODO verify all references in machine are present in config
  // TODO check format of all nodes to be valid

  const resolveNode = (state) => {
    // TODO drill down into nested states
    return definition.states[state.value]
  }
  const entry = (state, event) => actions(state, event, 'entry')
  const exit = (state, event) => actions(state, event, 'exit')
  const transitions = (state, event) => actions(state, event, 'transitions')
  const actions = (state, event, property) => {
    const node = resolveNode(state)
    const actions = node[property]
    let actionNames = []
    if (!actions) {
      return state
    }
    if (typeof actions === 'string') {
      actionNames.push(actions)
    } else {
      assert(Array.isArray(actions))
      actionNames.push(...actions)
    }
    debug(`%o actions: `, property, actionNames)
    for (const actionName of actionNames) {
      const fn = config.actions[actionName]

      assert.strictEqual(typeof fn, 'function')
      const result = fn(state.context, event)
    }
    return state
  }
  const isInvoke = (state) => {
    const node = resolveNode(state)
    return !!node.invoke
  }
  const invoke = async (state, event) => {
    const node = resolveNode(state)
    const { invoke } = node
    if (invoke) {
      debug(`asyncFunction name: %o`, node.invoke.src)
      const asyncFunction = config.services[invoke.src]
      assert.strictEqual(typeof asyncFunction, 'function')
      try {
        const data = await asyncFunction(state.context, event)
        event = { type: `done.invoke.${invoke.src}`, data }
        state = resolveTransition(state, event)
        return { state, event }
      } catch (data) {
        debug(`invoke error: `, data)
        event = { type: `error.invoke.${invoke.src}`, data }
        state = resolveTransition(state, event)
        return { state, event }
      }
    }
  }
  const resolveTransition = (state, event) => {
    assert(!state.transition)
    const node = resolveNode(state)
    let transitions
    if (isInvoke(state)) {
      if (event.type.startsWith('done.invoke')) {
        transitions = node.invoke.onDone
      } else {
        transitions = node.onError
      }
    } else if (state.always) {
      transitions = node.always
    } else {
      if (!node.on) {
        return state
      } else {
        transitions = node.on[event.type]
        if (!transitions) {
          throw new Error(`State ${state.value} does not accept ${event.type}`)
        }
      }
    }
    if (!transitions) {
      const { transition, ...rest } = state
      return rest
    }
    if (typeof transitions === 'string') {
      transitions = { target: transitions }
    }
    if (!Array.isArray(transitions)) {
      transitions = [transitions]
    }
    transitions = transitions.map((transition) => {
      if (typeof transition === 'string') {
        transition = { target: transition }
      }
      return transition
    })
    debug(`resolveTransition`, transitions)
    for (const transition of transitions) {
      const { cond } = transition
      if (cond) {
        assert.strictEqual(typeof cond, 'function')
        if (cond(context, event)) {
          return { ...state, transition }
        }
      } else {
        return { ...state, transition }
      }
    }
    throw new Error(`No transition possible - event swallowed`)
  }
  const isPending = (state) => {
    return !!state.transition
  }
  const isFinal = () => state.type === 'final' || state.watchdog > 100
  const doneData = (event) => {
    const dataFn = state.data || (() => undefined)
    assert.strictEqual(typeof dataFn, 'function')
    return dataFn(context, event)
  }
  const settleState = async (state, event) => {
    let { value, watchdog } = state
    debug(`loop ${++watchdog} stateValue: %o`, value)
    state = { ...state, watchdog }

    if (isInvoke(state)) {
      const invokeResult = await invoke(state, event)
      state = invokeResult.state
      event = invokeResult.event
    } else {
      state = resolveTransition(state, event)
    }

    if (isPending(state)) {
      state = exit(state, event)
      state = makeTransition(state, event)
      return await settleState(state, event) // means prior states are available on the stack for debugging
    }
    if (isFinal()) {
      return doneData(event)
    }
    return state
  }
  const makeTransition = (state, event) => {
    assert(state.transition)
    debug(`makeTransition event: %o trans: %o`, event.type, state.transition)
    state = { ...state, value: state.transition.target }
    assert(resolveNode(state))

    const { actions } = state.transition
    if (actions) {
      assert(Array.isArray(actions))
      for (const action of actions) {
        const fn = config.actions[action]
        const result = fn(state.context, event)
      }
    }
    delete state.transition
    state = entry(state, event)
    debug(`transition complete to: %o`, state.value)
    return state
  }
  let state = {
    value: undefined,
    context: definition.context || {},
    transition: { target: definition.initial },
    watchdog: 0,
  }
  const init = { type: 'xstate.init' }
  state = makeTransition(state, init)

  state = await settleState(state, event)
  return state
}
