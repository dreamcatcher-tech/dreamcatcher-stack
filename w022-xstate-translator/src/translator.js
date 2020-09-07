const assert = require('assert')
const debug = require('debug')('interblock:xstate:translator')
const _ = require('lodash')
const { State } = require('xstate')
const {
  request,
  promise,
  resolve,
  reject,
  isReplyFor,
} = require('../../w002-api')

const respond = (payload) => {
  if (typeof payload === 'string') {
    payload = { type: payload }
  }
  return {
    type: '@@RESPOND',
    payload,
  }
}
const send = (action, path = '.') => ({
  type: '@@SEND',
  payload: action,
  path,
})
const sendParent = (action) => ({
  type: '@@SEND_PARENT',
  payload: action,
  path: '..',
})

const invokeFactory = () => {
  //Used to make remote requests, and await their return.
  const invoke = async (type, payload, to) => {
    const requestAction = request(type, payload, to)
    debug(`invoke: %O`, requestAction.type)
    assert(typeof _callback === 'function', `_callback not set`)
    return _callback(requestAction)
  }
  let _callback
  invoke._hook = (callback) => {
    assert(!_callback, `attempt to overwrite hook`)
    _callback = callback
  }
  invoke._clearHook = () => {
    assert(_callback, `attempt to remove empty hook`)
    _callback = undefined
  }
  return invoke
}

const invoke = invokeFactory()

/**
 * Will do anything the user wants, but only our api actions
 * will be translated into protocol actions and sent out.
 */
const translator = (machine) => {
  const initialState = {
    xstate: machine.initialState,
    promises: [],
    requestId: 0,
    originAction: undefined,
  }
  return async (state = initialState, action) => {
    assert(!state.actions, `Actions key disallowed in state`)
    // TODO start new or upgraded covenants with @@INIT ?
    if (action.type === '@@TIMESTAMP') {
      if (!state.xstate) {
        action = '@@INIT'
      } else {
        return state
      }
    }
    if (typeof action === 'string') {
      action = { type: action }
    }
    if (action.type.startsWith('done.invoke.')) {
      // TODO move to unmap function
      // we clobber the data key
      action = { ...action, data: action.payload }
    }

    debug('translator reducer action: %O', action)
    state = state.xstate ? state : initialState
    let { xstate, promises, requestId, originAction } = state
    assert(!xstate.actions || !xstate.actions.length, `uncleared xstate`)

    if (isReplyFor(action)) {
      debug(`reply received: ${action.type}`)
      // update the accumulator, rerun the service
      // throw if not one of our promises
      const tracker = promises.find(
        ({ response }) => response && isReplyFor(action, response)
      )
      assert(tracker, `No promise found for action ${action.type}`)
      const accumulator = [...tracker.accumulator]
      accumulator.push(action.payload)
      const transientTracker = { ...tracker, accumulator }
      const nextTracker = await exhaust(machine, transientTracker, requestId++)
      promises = promises.filter((t) => t !== tracker)
      if (!nextTracker.done) {
        promises.push(nextTracker)
        return {
          ...state,
          promises,
          requestId,
          actions: [nextTracker.response],
        }
      }
      assert(!promises.length) // TODO handle dangling promises

      debug(`transforming into doneInvoke: %O`, action.type)
      // TODO create reject invoke
      action = createDoneInvoke(nextTracker.response, nextTracker.src) // TODO use proper id
    } else {
      // TODO handle dangling promises resets originAction
      if (!originAction) {
        debug(`setting originAction: %O`, action.type)
        originAction = action
      }
    }

    debug(`previous machine state: `, xstate.value)
    const previousState = State.create(xstate)
    const resolvedState = machine.resolveState(previousState)
    assertActionIsValid(resolvedState, action)
    const transientState = machine.transition(resolvedState, action)
    debug(`next machine state: `, transientState.value)

    const json = transientState.toJSON() // TODO use traverse to remove circular https://www.npmjs.com/package/traverse
    const { actions, ...nextState } = json
    const cleanNextState = JSON.parse(JSON.stringify(nextState))
    const { context, event } = cleanNextState
    checkActions(actions)

    const protocolActions = []
    const isRespond = actions.some(({ type }) => type === '@@RESPOND')
    const isXstateStart = actions.some(({ type }) => type === 'xstate.start')
    if (!isRespond && isXstateStart && originAction === action) {
      protocolActions.push(promise())
    }

    const awaits = actions.map(async (xstateAction) => {
      switch (xstateAction.type) {
        case 'xstate.start':
          debug(`invoke called`)
          const { activity } = xstateAction
          assert(activity && activity.type === 'xstate.invoke')
          const { src } = activity

          const tracker = {
            context,
            event,
            src,
            accumulator: [],
            done: false,
          }
          const nextTracker = await exhaust(machine, tracker, requestId++)
          const nextResponse = nextTracker.response
          debug(`invoke result: `, nextResponse && nextResponse.type)

          if (nextTracker.done) {
            const { response, src } = nextTracker
            debug(`tracker done immediately after starting`)
            const doneInvoke = createDoneInvoke(response, src)
            // TODO clear promises ?
            const mapped = mapXstateToContinuation(doneInvoke)
            protocolActions.push(mapped)
          } else {
            promises = [...promises, nextTracker]
            // TODO assert nextTracker.response is not a continuation action
            // but rather is a send, with an address
            protocolActions.push(nextTracker.response)
          }
          break
        case 'xstate.stop': // end of invoke
          debug(`end of invoke`)
          break
        default:
          debug('default: %O', xstateAction)
          // TODO handle assignment actions
          if (xstateAction.exec) {
            const execResult = xstateAction.exec(context, event)
            debug(`execResult %O`, execResult)
            const mapped = mapXstateToContinuation(execResult, originAction)
            protocolActions.push(mapped)
          } else {
            debug(`standard action ? %O`, xstateAction)
            const mapped = mapXstateToContinuation(xstateAction, originAction)
            protocolActions.push(mapped)
          }
          break
      }
    })

    await Promise.all(awaits)

    if (!protocolActions.length) {
      // the state machine is exhausted, and so the origin action can be resolved
      protocolActions.push(resolve(originAction))
      originAction = undefined
    }
    if (isResolved(protocolActions, originAction)) {
      originAction = undefined
    }

    debug(`shell actions length: `, protocolActions.length)
    return {
      actions: protocolActions,
      xstate: cleanNextState,
      promises,
      requestId,
      originAction,
    }
  }
}

const isResolved = (protocolActions, originAction) =>
  protocolActions.some(({ request }) => _.isEqual(request, originAction))

const exhaust = async (machine, tracker, requestId) => {
  // TODO handle torn promises - stop if state has moved on ?
  debug(`exhaust requestId: ${requestId}`)
  const { context, event, src, accumulator } = tracker
  const service = machine.options.services[src]
  assert(typeof service === 'function')

  let callCount = 0
  invoke._hook(async (rawResponse) => {
    debug(`reExecute hook invoked`)
    if (callCount < accumulator.length) {
      const prior = accumulator[callCount]
      callCount++
      debug(`prior resolve returned`)
      return prior
    }
    debug(`making new response with id: ${requestId}`)
    assert(typeof rawResponse.payload.requestId === 'undefined')
    const payload = { ...rawResponse.payload, requestId }
    const response = { ...rawResponse, payload }
    exhaustedTrigger(response)
    const eternalPromise = new Promise(() => {})
    return eternalPromise
  })

  let exhaustedTrigger
  const invokeExhausted = async () => {
    const invokeEnd = new Promise((resolve, reject) => {
      debug(`setting exhaustedTrigger`)
      exhaustedTrigger = (response) => {
        debug(`exhaustedTrigger pulled: %O`, response)
        resolve(response)
      }
    })
    return invokeEnd
  }

  const invokeExhaustedPromise = raceCar('invoke', invokeExhausted())
  const servicePromise = raceCar('service', service(context, event))
  const reaperPromise = raceCar('reaper', new Promise(setImmediate))

  const racers = [invokeExhaustedPromise, servicePromise, reaperPromise]
  const firstToFinish = await Promise.race(racers)
  invoke._clearHook()
  const { name, response } = firstToFinish
  switch (name) {
    case 'invoke':
      debug(`invoke completed first`)
      return { ...tracker, response }
    case 'service':
      debug(`service completed first`)
      return { ...tracker, response, done: true }
    case 'reaper':
      throw new Error(`Neither service nor invoke completed in time`)
    default:
      throw new Error(`Unreachable`)
  }
}

const raceCar = async (name, promise) => {
  let response = await promise
  if (typeof response === 'string') {
    response = { type: response }
  }
  return { name, response }
}

const createDoneInvoke = (data, id) => {
  if (data && data.message && data.stack) {
    // xstate seems to blank error objects
    // TODO never include error objects in done - make a special done object
    debug(`error detected %O`, data)
    const { message, stack } = data
    data = { ...data, stack, message }
  }
  return { type: 'done.invoke.' + id, data }
}

const checkActions = (actions) => {
  assert(Array.isArray(actions))
  // TODO check respond overrides invoke
  // TODO check that invoke can only occur once
}

const mapXstateToContinuation = (xstateAction, originAction) => {
  switch (xstateAction.type) {
    case '@@SEND':
      // TODO break out the paths, send as specified
      debug(`send: %O`, xstateAction)
      return // TODO
    case '@@SEND_PARENT':
      // TODO handle parent being the alias
      debug(`sendParent: %O`, xstateAction)
      return // TODO
    case '@@RESPOND':
      // TODO use the origin action
      const resolveAction = resolve(originAction, xstateAction.payload)
      debug(`respond: `, resolveAction.type)
      return resolveAction
    default:
      if (xstateAction.type.startsWith('done.invoke.')) {
        // we clobber data key
        return { ...xstateAction, payload: xstateAction.data }
      }
      return xstateAction
  }
}

const assertActionIsValid = (state, action) => {
  if (!state.nextEvents.includes(action.type)) {
    const type = action && action.type
    const value = state && state.value
    throw new Error(`State: ${value} does not accept event type: ${type}`)
  }
}

module.exports = { respond, send, sendParent, invoke, translator }
