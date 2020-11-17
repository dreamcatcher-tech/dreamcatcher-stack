const assert = require('assert')
const debug = require('debug')('interblock:api:hooks')
const { request, promise, resolve, reject, isReplyFor } = require('./api')

const _eternalPromise = new Promise(() => {
  // this can never resolve, as we do not want to execute the reducer code past this point.
})
_eternalPromise.isEternal = true
Object.freeze(_eternalPromise)

// TODO error if promise called more than once
const replyPromise = () => _pushGlobalReply(promise())
// TODO error if resolve against the same request more than once, which includes default action
const replyResolve = (payload, request) =>
  _pushGlobalReply(resolve(payload, request))
const replyReject = (error, request) => push()

const push = () => {
  // generate an action that is a reply to the current one ?
  // probably promise, resolve, reject are allowed actions
}

const interchain = async (type, payload, to) => {
  // make an async call to another chain
  const standardRequest = request(type, payload, to)
  assert(standardRequest.to !== '@@io')
  return _promise(standardRequest)
}

const effect = async (type, fn, ...args) => {
  // promise that will be placed on the @@io queue and later executed
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof fn, 'function')
  const requestId = _incrementGlobalRequestId()

  const payload = { args, ['@@ioRequestId']: requestId }
  const exec = () => fn(...args)
  return _promise({ type, payload, to: '@@io', exec, inBand: false })
}

const effectInBand = async (type, fn, ...args) => {
  // polite way to make a promise that will be included in blocking process
  // must be repeatable or else block verification will fail
  // if not repeatable, should use an effect instead
  const payload = { args }
  const exec = () => fn(...args)
  return _promise({ type, payload, exec, inBand: true })
}

const _promise = (request) => {
  debug(`_promise request.type: %o`, request.type)
  const accumulator = _getGlobalAccumulator()
  assert(Array.isArray(accumulator))
  const { type, payload, to, exec, inBand } = request
  assert(!exec || typeof exec === 'function')
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

const hook = async (tick, accumulator = [], salt = 'unsalted') => {
  assert.strictEqual(typeof tick, 'function')
  assert(Array.isArray(accumulator))
  assert.strictEqual(typeof salt, 'string')
  debug(`hook salt:`, salt)
  let actions
  try {
    await _hookGlobal(accumulator, salt)
    let reduction = tick()
    let isPending = false

    assert(reduction, `Must return something from tick`)

    if (typeof reduction.then === 'function') {
      // unwrap native async queue
      const racecar = Symbol('RACECAR')
      // TODO be able to have multiple concurrent hooks active, as sometimes needs to await deeper in the eventloop to run the hooks code
      // TODO implement a wait loop, to avoid collisions
      const racetrack = new Promise((resolve) =>
        setImmediate(() => resolve(racecar))
      )
      const result = await Promise.race([reduction, racetrack])
      const isStillPending = result === racecar
      actions = _unhookGlobal()

      if (isStillPending && !actions.requests.length) {
        // seems impossible to know if was a native promise, or our promise, until actions are exhausted by replies
        throw new Error(
          `Non standard promise returned - use "effectInBand(...)"`
        )
      }
      if (!isStillPending) {
        // must unwrap fully from the async/await wrapper
        reduction = await reduction
        isPending = false
      } else {
        reduction = undefined
        isPending = true
      }
    } else {
      actions = _unhookGlobal()
    }
    const { requests, replies } = actions
    return { reduction, isPending, requests, replies } // rejection is handled by tick throwing ?
  } catch (error) {
    debug(`error: `, error)
    !actions && _unhookGlobal()
    throw error
  }
}

const _hookGlobal = async (originalAccumulator, salt) => {
  globalThis['@@interblock'] = globalThis['@@interblock'] || {}
  const start = Date.now()
  while (globalThis['@@interblock'].promises) {
    debug(`waiting for global: ${Date.now() - start}ms`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert(!globalThis['@@interblock'].promises)
  const accumulator = [...originalAccumulator]
  Object.freeze(accumulator)
  const requestId = 0
  const promises = { accumulator, requests: [], replies: [], requestId, salt }
  globalThis['@@interblock'].promises = promises
}

const _unhookGlobal = () => {
  _assertGlobals()
  const { requests, replies } = globalThis['@@interblock'].promises
  delete globalThis['@@interblock'].promises
  return { requests, replies }
}

const _getGlobalAccumulator = () => {
  _assertGlobals()
  const { accumulator } = globalThis['@@interblock'].promises
  debug(`_getGlobalAccumulator`)
  return accumulator
}
const _pushGlobalRequest = (request) => {
  _assertGlobals()
  const { requests } = globalThis['@@interblock'].promises
  debug(`_pushGlobalRequest`, request.type)
  requests.push(request)
}
const _pushGlobalReply = (reply) => {
  _assertGlobals()
  const { replies } = globalThis['@@interblock'].promises
  debug(`_pushGlobalReply`, reply.type)
  replies.push(reply)
}

const _incrementGlobalRequestId = () => {
  const { salt } = globalThis['@@interblock'].promises
  const requestId = globalThis['@@interblock'].promises.requestId++
  return `${requestId}_${salt}`
}

const _assertGlobals = () => {
  assert(globalThis['@@interblock'])
  assert(globalThis['@@interblock'].promises)
  const { accumulator, requests, replies, requestId } = globalThis[
    '@@interblock'
  ].promises
  assert(Array.isArray(accumulator))
  assert(Array.isArray(requests))
  assert(Array.isArray(replies))
  assert(Number.isInteger(requestId) && requestId >= 0)
}

module.exports = {
  replyPromise,
  replyResolve,
  replyReject,
  interchain,
  effect,
  effectInBand,
  all,
  '@@GLOBAL_HOOK': hook, // system use only
}
