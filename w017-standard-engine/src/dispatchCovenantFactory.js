const assert = require('assert')
const { isReplyFor, request } = require('../../w002-api')
const debug = require('debug')('interblock:effector:dispatchCovenant')

const dispatchCovenantFactory = () => {
  // TODO make this a HOR that wraps any reducer
  const promises = new Map()
  const dispatches = []
  const reducer = (state = {}, reply) => {
    assert(reply, `must supply an action`)
    debug('reducer: %o', reply.type)
    // TODO settle promises only when a new block is formed, not during isolation, as too early
    // make the promise await for block to store, then resolve what was resolved here
    for (const [request, { pending, settled }] of promises) {
      if (isReplyFor(reply, request)) {
        debug(`reply received: %j for: %j`, reply.type, request.type)
        pending.resolve()
        switch (reply.type) {
          case '@@REJECT':
            settled.reject(reply.payload)
            break
          case '@@PROMISE':
            throw new Error(`Promises should never be seen by covenants`)
          case '@@RESOLVE':
            settled.resolve(reply.payload)
            promises.delete(request)
            break
        }
      }
    }
    const actions = [...dispatches]
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

module.exports = dispatchCovenantFactory
