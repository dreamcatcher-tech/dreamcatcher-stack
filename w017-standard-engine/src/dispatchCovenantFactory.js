const assert = require('assert')
const { isReplyFor, request } = require('../../w002-api')
const debug = require('debug')('interblock:effector:dispatchCovenant')
const { unity } = require('../../w212-system-covenants')

const dispatchCovenantFactory = (wrappedReducer = unity.reducer) => {
  // TODO make this a HOR that wraps any reducer
  const promises = new Map()
  const dispatches = []
  const reducer = (state, action) => {
    assert(action, `must supply an action`)
    debug('reducer: %o', action.type)
    // TODO settle promises only when a new block is formed, not during isolation, as too early
    // make the promise await for block to store, then resolve what was resolved here
    let consumed = false
    for (const [request, { pending, settled }] of promises) {
      if (isReplyFor(action, request)) {
        debug(`reply received: %j for: %j`, action.type, request.type)
        consumed = true
        pending.resolve()
        switch (action.type) {
          case '@@REJECT':
            settled.reject(action.payload)
            promises.delete(request)
            break
          case '@@PROMISE':
            throw new Error(`Promises should never be seen by covenants`)
          case '@@RESOLVE':
            settled.resolve(action.payload)
            promises.delete(request)
            break
        }
      }
    }
    let wrappedActions = []
    if (!consumed) {
      state = wrappedReducer(state, action)
      assert.strictEqual(typeof state, 'object', `wrappedReducer invalid state`)
      Array.isArray(state.actions) && wrappedActions.push(...state.actions)
    }
    const actions = [...dispatches, ...wrappedActions]
    dispatches.length = 0
    return { ...state, actions }
  }

  let _dispatchId = 0
  const injector = async ({ type, payload, to }) => {
    debug(`injector: %s id: %i to: %s`, type, _dispatchId, to)
    payload = { ...payload, _dispatchId }
    _dispatchId++
    const action = request(type, payload, to)
    const promise = generateDispatchPromise(action)
    dispatches.push(action)
    await Promise.resolve()
    return promise
  }

  const generateDispatchPromise = (request) => {
    const promise = {}
    const settled = new Promise((resolve, reject) => {
      promise.settled = { resolve, reject }
    })
    settled.pending = new Promise((resolve, reject) => {
      promise.pending = { resolve, reject }
    })
    promises.set(request, promise)
    return settled
  }

  return { injector, reducer }
}

module.exports = { dispatchCovenantFactory }
