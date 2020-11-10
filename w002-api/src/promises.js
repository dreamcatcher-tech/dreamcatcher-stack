const assert = require('assert')
const debug = require('debug')('interblock:api:promises')
const { isReplyFor } = require('./api')

const _eternalPromise = new Promise(() => {})
_eternalPromise.isEternal = true
Object.freeze(_eternalPromise)

const pushPromise = () => push()
const pushResolve = (payload, request) => push()
const pushReject = (error, request) => push()

const push = () => {
  // generate an action that is a reply to the current one ?
  // probably promise, resolve, reject are allowed actions
}

const interchain = async (type, payload, to) => {
  // make an async call to another chain
  assert(to !== '@@io')
  return _promise({ type, payload, to })
}

const effect = async (type, exec, ...args) => {
  // promise that will be placed on the @@io queue and later executed
  const payload = { args }
  return _promise({ type, payload, to: '@@io', exec, inBand: false })
}

const effectInBand = async (type, exec, ...args) => {
  // polite way to make a promise that will be included in blocking process
  // must be repeatable or else block verification will fail
  // if not repeatable, should use an effect instead
  const payload = { args }

  return _promise({ type, payload, exec, inBand: true })
}

const _promise = (request) => {
  debug(`_promise request.type: %o`, request.type)
  const accumulator = _getGlobalAccumulator()
  assert(Array.isArray(accumulator))
  const { type, to, exec, inBand } = request
  assert(!exec || typeof exec === 'function')
  const requestId = _incrementGlobalRequestId()
  payload = { ...request.payload, ['__@@requestId']: requestId }
  const requestWithId = { type, payload, to }

  const reply = accumulator.find((reply) => isReplyFor(reply, requestWithId))
  if (!reply) {
    if (exec) {
      requestWithId.exec = exec
      requestWithId.inBand = inBand
    }
    _pushGlobalRequest(requestWithId)
    return _eternalPromise
  }
  if (reply.type === '@@RESOLVE') {
    return reply.payload
  }
  throw reply.payload
}

const all = async (...promiseActions) => {
  // awaits multiple requests to multiple chains and or multiple effects to complete
}

const hook = async (tick, accumulator, salt) => {
  assert.strictEqual(typeof tick, 'function')
  assert(Array.isArray(accumulator))
  debug(`hook`)

  _hookGlobal(accumulator, salt)
  let reduction = tick()
  let pending = false
  const actions = _unhookGlobal()

  assert(reduction, `Must return something from tick`)

  if (typeof reduction.then === 'function') {
    await Promise.resolve('unwrap native async queue')
    const racecar = Symbol('RACECAR')
    const result = await Promise.race([reduction, Promise.resolve(racecar)])
    const isStillPending = result === racecar

    if (isStillPending && !actions.length) {
      // seems impossible to know if was a native promise, or our promise, until actions are exhausted by replies
      throw new Error(`Non standard promise returned - use "effectInBand(...)"`)
    }
    if (!isStillPending) {
      // must unwrap fully from the async/await wrapper
      reduction = await reduction
      pending = false
    } else {
      reduction = undefined
      pending = true
    }
  }
  return { reduction, pending, actions } // rejection is handled by tick throwing ?
}

const _hookGlobal = (originalAccumulator, salt) => {
  globalThis['@@interblock'] = globalThis['@@interblock'] || {}
  assert(!globalThis['@@interblock'].promises)
  const accumulator = [...originalAccumulator]
  Object.freeze(accumulator)
  const promises = { accumulator, actions: [], requestId: 0, salt }
  globalThis['@@interblock'].promises = promises
}

const _unhookGlobal = () => {
  _assertGlobals()
  const { actions } = globalThis['@@interblock'].promises
  delete globalThis['@@interblock'].promises
  return actions
}

const _getGlobalAccumulator = () => {
  _assertGlobals()
  const { accumulator } = globalThis['@@interblock'].promises
  debug(`_getGlobalAccumulator`)
  return accumulator
}
const _pushGlobalRequest = (request) => {
  _assertGlobals()
  const { actions } = globalThis['@@interblock'].promises
  debug(`_pushGlobalRequest`, request)
  actions.push(request)
}

const _incrementGlobalRequestId = () => {
  const { salt } = globalThis['@@interblock'].promises
  const requestId = globalThis['@@interblock'].promises.requestId++
  return `${requestId}_${salt}`
}

const _assertGlobals = () => {
  assert(globalThis['@@interblock'])
  assert(globalThis['@@interblock'].promises)
  const { accumulator, actions, requestId } = globalThis[
    '@@interblock'
  ].promises
  assert(Array.isArray(accumulator))
  assert(Array.isArray(actions))
  assert(Number.isInteger(requestId) && requestId >= 0)
}

module.exports = {
  interchain,
  effect,
  effectInBand,
  all,
  '@@GLOBAL_HOOK': hook, // system use only
}
