const assert = require('assert')
const debug = require('debug')('interblock:xstate:translator')
const _ = require('lodash')
const equal = require('fast-deep-equal')
const { State } = require('xstate')
const {
  request,
  promise,
  resolve,
  reject,
  isReplyFor,
  replyPromise,
  replyReject,
  replyResolve,
  interchain,
} = require('../../w002-api')

const respond = (payload) => {
  if (typeof payload === 'string') {
    payload = { type: payload }
  }
  // TODO copy how actions work in xstate, so can send something back ?
  return {
    type: '@@RESPOND',
    data: payload,
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

/**
 * Will do anything the user wants, but only our api actions
 * will be translated into protocol actions and sent out.
 */
const translator = (machine) => {
  const { initialState } = machine

  return async (xstate, action) => {
    assert.strictEqual(typeof action, 'object')
    if (!xstate || equal(xstate, {})) {
      xstate = initialState
    }
    assert(!xstate.actions || !xstate.actions.length, `uncleared xstate`)
    // TODO start new or upgraded covenants with @@INIT ?
    if (action.type.startsWith('done.invoke.')) {
      // we clobber the data key that xstate requires
      // TODO move to unmap function
      action = { ...action, data: action.payload }
      delete action.payload
    }
    debug('translator reducer action: %O', action)

    if (isReplyFor(action)) {
      debug(`ignoring reply received: `, action)
      return xstate
      // TODO reject external replies, ignore loopback replies
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
    checkXstateActions(actions)
    const originAction = cleanNextState.history.event
    debug(`originAction: `, originAction.type)

    const awaits = actions.map(async (xstateAction) => {
      switch (xstateAction.type) {
        case 'xstate.start':
          debug(`xstate.start`)
          const { activity } = xstateAction
          assert(activity && activity.type === 'xstate.invoke')
          const { src } = activity
          const service = machine.options.services[src]
          assert(typeof service === 'function')
          debug(`running service: `, src)

          const nextResponse = await service(context, event)
          debug(`invoke result: `, nextResponse && nextResponse.type)

          const { type, data } = createDoneInvoke(nextResponse, src)
          debug(`doneInvoke`, data)
          interchain(type, data) // send to self
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
            mapXstateToContinuation(execResult, originAction)
          } else {
            debug(`standard action ? %O`, xstateAction)
            const mapped = mapXstateToContinuation(xstateAction, originAction)
            protocolActions.push(mapped)
          }
          break
      }
    })
    await Promise.all(awaits)
    return cleanNextState
  }
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
const checkXstateActions = (actions) => {
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
      debug(`@@RESPOND to: `, originAction.type)
      replyResolve(xstateAction.data, originAction)
      break
    default:
      if (xstateAction.type.startsWith('done.invoke.')) {
        // we clobber data key
        const mapped = { ...xstateAction, payload: xstateAction.data }
        delete mapped.data
        return mapped
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

module.exports = { respond, send, sendParent, translator }
