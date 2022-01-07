import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:xstate:pure')

const createContext = (initial) => {
  let context = initial || {}
  return {
    getContext: () => context,
    setContext: (nextContext) => {
      context = nextContext
    },
  }
}

const pure = async (event, definition, config = {}) => {
  assert.strictEqual(typeof config, 'object')
  if (typeof event === 'string') {
    event = { type: event }
  }
  // TODO validate machine against xstate, then cache the result
  // TODO verify all references in machine are present in config
  // TODO check format of all nodes to be valid
  const contextMgr = createContext(definition.context) // shared context for parallel states

  const resolveGrandparent = (state) => resolvePath(state).grandparent
  const resolveParent = (state) => resolvePath(state).parent
  const resolveNode = (state) => resolvePath(state).node
  const resolvePath = (state) => {
    const path = [...splitPath(state.value)]
    let node = definition
    let parent, grandparent
    do {
      grandparent = parent
      parent = node
      const { states } = node
      const value = path.shift()
      node = states[value]
    } while (path.length)
    // debug(`resolveNode: `, state.value, node)
    return { grandparent, parent, node }
  }
  const entry = (state, event) => actions(state, event, 'entry')
  const exit = (state, event) => actions(state, event, 'exit')
  const actions = (state, event, property) => {
    const node = resolveNode(state)
    const actions = node[property]
    debug(`actions property:`, property)
    return execActions(state, event, actions)
  }
  const execActions = (state, event, actions) => {
    if (!actions) {
      return state
    }
    let actionNames = []
    if (typeof actions === 'string') {
      actionNames.push(actions)
    } else {
      assert(Array.isArray(actions))
      actionNames.push(...actions)
    }
    debug(`execActions: `, actionNames)
    for (const actionName of actionNames) {
      const fn = config.actions[actionName]
      assert(fn, `No action found for: ${actionName}`)
      if (fn.type === 'xstate.assign') {
        let context = { ...contextMgr.getContext() }
        if (typeof fn.assignment === 'function') {
          context = fn.assignment(context, event)
        } else {
          assert(typeof fn.assignment === 'object')
          for (const key of Object.keys(fn.assignment)) {
            context[key] = fn.assignment[key](context, event)
          }
        }
        contextMgr.setContext(context)
      } else {
        assert.strictEqual(typeof fn, 'function')
        fn(contextMgr.getContext(), event)
      }
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
      const msg = `missing function: ${invoke.src}`
      assert.strictEqual(typeof asyncFunction, 'function', msg)
      try {
        const data = await asyncFunction(contextMgr.getContext(), event)
        event = { type: `done.invoke.${invoke.src}`, data }
        state = resolveTransition(state, event)
        return { state, event }
      } catch (data) {
        debug(`invoke error: %o`, data.message)
        event = { type: `error.invoke.${invoke.src}`, data }
        state = resolveTransition(state, event)
        return { state, event }
      }
    }
  }
  const resolveNestedState = (state) => {
    assert(isParent(state))
    const node = resolveNode(state)
    const transition = { target: state.value + '.' + node.initial }
    debug(`resolveNestedState`, transition)
    return { ...state, transition }
  }
  const resolveTransition = (state, event) => {
    assert(!state.transition)
    const node = resolveNode(state)
    let transitions
    if (isInvoke(state)) {
      if (event.type.startsWith('done.invoke')) {
        transitions = node.invoke.onDone
      } else {
        transitions = node.invoke.onError
        if (!transitions) {
          console.error('error in invoke:', event.data)
          throw event.data
        }
      }
    } else if (node.always) {
      transitions = node.always
    } else if (isFinal(state) && !isDone(state)) {
      assert(state.value.includes('.'))
      const parent = resolveParent(state)
      transitions = parent.onDone
    } else if (isParallel(state)) {
      // TODO assert all child states are in final state ?
      assert(node.onDone)
      transitions = node.onDone
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
    transitions = transitions.map((transition) =>
      absoluteTransition(state, transition)
    )
    debug(`resolveTransition`, transitions)
    for (const transition of transitions) {
      const { cond } = transition
      if (cond) {
        const condFn = config.guards[cond]
        assert.strictEqual(typeof condFn, 'function', cond)
        if (condFn(contextMgr.getContext(), event)) {
          return { ...state, transition }
        }
      } else {
        return { ...state, transition }
      }
    }
    throw new Error(`No transition possible - event swallowed`)
  }
  const absoluteTransition = (state, transition) => {
    if (typeof transition === 'string') {
      transition = { target: transition }
    }
    let { target } = transition
    if (!target.startsWith('.') && state.value.includes('.')) {
      const path = [...splitPath(state.value)]
      path.pop()
      if (isFinal(state)) {
        path.pop()
      }
      path.push(target)
      target = path.join('.')
      transition = { ...transition, target }
    }
    if (target.startsWith('.')) {
      target = state.value + target
      transition = { ...transition, target }
    }
    return transition
  }
  const isPending = (state) => {
    return !!state.transition
  }
  const isFinal = (state) => {
    const node = resolveNode(state)
    return node.type === 'final'
  }
  const isParallel = (state) => {
    const node = resolveNode(state)
    return node.type === 'parallel'
  }
  const isParent = (state) => {
    const node = resolveNode(state)
    return node.initial
  }
  const isDone = (state) => isFinal(state) && !state.value.includes('.')
  const isGrandparentParallel = (state) => {
    const grandparent = resolveGrandparent(state)
    return grandparent && grandparent.type === 'parallel'
  }
  const doneData = (state, event) => {
    debug(`doneData`)
    const node = resolveNode(state)
    const dataFn = node.data || (() => undefined)
    assert.strictEqual(typeof dataFn, 'function')
    return dataFn(contextMgr.getContext(), event)
  }
  /**
   * All states share the same live context.
   * State.value becomes an array ?
   * Get to the state where all substates are finalized
   */
  const pdbg = debug.extend('parallel')
  const parallel = async (state, event) => {
    // fire off concurrent settleState events
    pdbg(`parallel start`, state.value)
    const node = resolveNode(state)
    assert.strictEqual(typeof node.states, 'object')
    pdbg(`node: `, node)

    const awaits = []
    for (const subnodeKey in node.states) {
      awaits.push(processInParallel(state, subnodeKey))
    }

    await Promise.all(awaits)
    event = { type: `done.parallel.(${state.value})` }
    state = resolveTransition(state, event)
    // then take the onDone transition
    pdbg(`parallel complete: `, state.value)
    return { state, event }
  }
  const processInParallel = async (state, subnodeKey) => {
    const transition = resolveParallelTransition(state, subnodeKey)
    pdbg(`transition: `, transition)
    let substate = { ...state, transition }
    substate = makeTransition(substate, event)
    pdbg(`substate prior: `, substate.value)
    substate = await settleState(substate, event)
    pdbg(`substate settled: `, substate.value)
    assert(isFinal(substate))
  }
  const resolveParallelTransition = (state, transition) => {
    // drilldown to transitions
    if (typeof transition === 'string') {
      transition = { target: transition }
    }
    const { target } = transition
    assert(isParallel(state))
    transition = { ...transition, target: state.value + '.' + target }
    return transition
  }
  const settleState = async (state, event) => {
    const { value } = state
    let { watchdog } = state
    if (watchdog > 500) {
      // throw new Error(`endless loop: ${watchdog}`)
    }
    debug(`loop ${++watchdog} stateValue: %o`, value)
    state = { ...state, watchdog }

    if (isInvoke(state)) {
      const invokeResult = await invoke(state, event)
      state = invokeResult.state
      event = invokeResult.event
    } else if (isParallel(state)) {
      const result = await parallel(state, event)
      state = result.state
      event = result.event
    } else if (isParent(state)) {
      // find the next state, and make the transition down to it
      state = resolveNestedState(state)
    } else {
      // bottomed out state
      state = resolveTransition(state, event)
    }
    if (isPending(state)) {
      state = exit(state, event)
      state = makeTransition(state, event)
      return settleState(state, event) // means prior states are available on the stack for debugging
    }
    if (isDone(state)) {
      if (state.value === 'error') {
        throw event.data
      }
      // if this is the top level state, and is final, return doneData
      debug(`isDone`, state)
      return doneData(state, event)
    }
    if (isGrandparentParallel(state)) {
      return state
    }
    debug(`Error state: `, state)
    debug(`Error event: `, event)
    throw new Error(`Settled on not final state: ${state.value}`)
  }
  const makeTransition = (state, event) => {
    assert(state.transition)
    debug(`makeTransition event: %o trans: %o`, event.type, state.transition)

    state = { ...state, value: state.transition.target }
    assert(resolveNode(state), `missing state node: ${state.value}`)
    const { actions } = state.transition
    delete state.transition

    state = execActions(state, event, actions)
    state = entry(state, event)
    debug(`transition complete to: %o`, state.value)
    return state
  }

  let state = {
    value: undefined,
    transition: { target: definition.initial },
    watchdog: 0,
  }
  const init = { type: 'xstate.init' }
  state = makeTransition(state, init)

  return settleState(state, event)
}
const splitPath = (path) => path.split('.')

export { pure }
