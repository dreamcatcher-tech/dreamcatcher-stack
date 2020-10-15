const assert = require('assert')
const { isReplyFor, request } = require('../../w002-api')
const debug = require('debug')('interblock:effector:dispatchCovenant')
const { unity } = require('../../w212-system-covenants')
const { v4: uuid } = require('uuid')

const dispatchCovenantFactory = (wrappedReducer = unity.reducer) => {
  const promises = new Map()
  const dispatches = []
  const id = uuid()
  let dispatchCounter = 0
  const injector = async ({ type, payload, to }) => {
    const _dispatchId = `${dispatchCounter++} ${id}`
    debug(`injector: %s to: %s id: %o`, type, to, _dispatchId)
    payload = { ...payload, _dispatchId }
    const action = request(type, payload, to)
    const promise = generateDispatchPromise(action)
    dispatches.push(action)
    await Promise.resolve()
    return promise
  }
  const reducer = async (state, action) => {
    assert.strictEqual(typeof action, 'object', `must supply an action object`)
    debug('reducer: %O', action.type)
    // TODO WARNING if the pierce does not cause a new block, it will be lost
    if (isPiercedReply(action)) {
      for (const [request, { pending, settled }] of promises) {
        if (isReplyFor(action, request)) {
          debug(`reply received: %O for: %O`, action.type, request.type)
          consumed = true
          pending.resolve()
          switch (action.type) {
            case '@@REJECT':
              setImmediate(settled.reject, action.payload)
              promises.delete(request)
              break
            case '@@PROMISE':
              throw new Error(`Promises should never be seen by covenants`)
            case '@@RESOLVE':
              setImmediate(settled.resolve, action.payload)
              promises.delete(request)
              break
          }
        }
      }
      return state
    } else {
      state = await wrappedReducer(state, action)
      assert.strictEqual(typeof state, 'object', `wrappedReducer invalid state`)
      const actions = []
      Array.isArray(state.actions) && actions.push(...state.actions)
      actions.push(...dispatches)
      dispatches.length = 0
      return { ...state, actions }
    }
  }

  const isPiercedReply = (action) => {
    assert.strictEqual(typeof action.payload, 'object', 'must supply payload')
    if (isReplyFor(action)) {
      assert.strictEqual(typeof action.request, 'object')
      assert.strictEqual(typeof action.request.payload, 'object')
      const { _dispatchId } = action.request.payload
      return (
        _dispatchId &&
        typeof _dispatchId === 'string' &&
        _dispatchId.endsWith(id)
      )
    }
    return false
  }

  const generateDispatchPromise = (request) => {
    const promise = {}
    // TODO remove pending promises
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
