import assert from 'assert-fast'
import equal from 'fast-deep-equal'
import setImmediate from 'set-immediate-shim'
import { request, promise, resolve, reject, isReplyFor } from './api'
import Debug from 'debug'
const debug = Debug('interblock:api:hooks')

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
const replyReject = (error, request) => _pushGlobalReply(reject(error, request))

const interchain = (type, payload, to) => {
  // make an async call to another chain
  const standardRequest = request(type, payload, to)
  assert(standardRequest.to !== '.@@io')
  return _promise(standardRequest)
}
const effect = (type, fn, ...args) => {
  // promise that will be placed on the .@@io queue and later executed
  // TODO effects should change to being able to be possibly resolvable
  assert.strictEqual(typeof type, 'string')
  assert.strictEqual(typeof fn, 'function')
  const requestId = _incrementGlobalRequestId()

  const payload = { args, ['.@@ioRequestId']: requestId }
  const exec = () => fn(...args)
  return _promise({ type, payload, to: '.@@io', exec, inBand: false })
}
const effectInBand = (type, fn, ...args) => {
  // polite way to make a promise that will be included in blocking process
  // must be repeatable or else block verification will fail
  // if not repeatable, should use an effect instead
  const payload = { args }
  const exec = () => fn(...args)
  return _promise({ type, payload, exec, inBand: true, to: undefined })
}
const query = (type, payload) => {
  const query = _promise({ type, payload, inBand: true, query: true })
  return query
}
const _promise = (request) => {
  debug(`_promise request.type: %o`, request.type)
  const accumulator = _getGlobalAccumulator()
  assert(Array.isArray(accumulator))
  const { type, payload, to, exec, inBand, query } = request
  assert(!exec || typeof exec === 'function')
  const bareRequest = { type, payload, to }

  const reply = accumulator.find((reply) => isReplyFor(reply, bareRequest))
  if (!reply) {
    const promise = new Promise((resolve, reject) => {
      bareRequest.resolve = resolve
      bareRequest.reject = reject
    })
    if (exec) {
      bareRequest.exec = exec
      bareRequest.inBand = inBand
    }
    if (query) {
      bareRequest.inBand = inBand
      bareRequest.query = query
    }
    _pushGlobalRequest(bareRequest)
    // TODO allow resolving of interchain promises between block boundaries
    return promise
  } else {
    // clean but excessive since nonce handles matching
    const index = accumulator.indexOf(reply)
    accumulator.splice(index, 1)
  }
  if (reply.type === '@@RESOLVE') {
    return reply.payload
  }
  assert.strictEqual(reply.type, '@@REJECT')
  throw reply.payload
}
const all = (...promiseActions) => {
  // awaits multiple requests to multiple chains and or multiple effects to complete
  throw new Error('Promise.all() Not Implemented')
}
const _hookGlobal = async (originalAccumulator, salt) => {
  globalThis['@@interblock'] = globalThis['@@interblock'] || {}
  const start = Date.now()
  while (globalThis['@@interblock'].promises) {
    await new Promise(setImmediate)
    // TODO ensure we never have to wait more than one setImmediate loop ?
  }
  const msg = `waited for global for ${Date.now() - start}ms`
  debug(msg)
  assert(!globalThis['@@interblock'].promises, msg)
  const accumulator = [...originalAccumulator]
  const requestId = 0
  const promises = { accumulator, requests: [], replies: [], requestId, salt }
  promises.bareRequests = []
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
  // TODO detect change in request order somehow
  _assertGlobals()
  const { requests, bareRequests } = globalThis['@@interblock'].promises
  const { type, payload, to } = request
  const bareRequest = { type, payload, to }
  const isDuplicate = bareRequests.some((prior) => equal(bareRequest, prior))
  if (isDuplicate) {
    throw new Error(`Duplicate request made: ${type}`)
  }
  debug(`_pushGlobalRequest`, request.type)
  requests.push(request)
  bareRequests.push(bareRequest)
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
  // TODO avoid needing a salt, or read it from the chain, or something not needing hash
  // or at the salt at post processing step, in the interpreter
  return `${requestId}_${salt}`
}
const _assertGlobals = () => {
  assert(globalThis['@@interblock'])
  assert(globalThis['@@interblock'].promises)
  const { accumulator, requests, replies, requestId } =
    globalThis['@@interblock'].promises
  assert(Array.isArray(accumulator))
  assert(Array.isArray(requests))
  assert(Array.isArray(replies))
  assert(Number.isInteger(requestId) && requestId >= 0)
}
// and now for the tricky part...
const execute = async (tick, accumulator = [], salt = 'unsalted') => {
  debug(`hook salt:`, salt)
  await _hookGlobal(accumulator, salt)
  let pending
  try {
    let reduction = tick()
    if (typeof reduction !== 'object') {
      throw new Error(`Must return object from tick: ${reduction}`)
    }
    const isPending = typeof reduction.then === 'function'
    pending = { reduction, isPending, requests: [], replies: [] }
  } catch (error) {
    debug(`error: `, error)
    _unhookGlobal()
    throw error
  }
  if (pending.isPending) {
    pending = await awaitPending(pending)
  } else {
    const { requests, replies } = _unhookGlobal()
    pending.requests = requests
    pending.replies = replies
  }
  return pending
}
const awaitPending = async (pending) => {
  let { reduction } = pending
  assert(typeof reduction.then === 'function', `Reduction is not a promise`)
  const racecar = Symbol('RACECAR')
  const racetrackShort = Promise.resolve(racecar)
  let result
  try {
    // unwrap native async queue
    result = await Promise.race([reduction, racetrackShort])
    if (result === racecar) {
      const racetrackLong = new Promise((resolve) =>
        setImmediate(() => resolve(racecar))
      )
      result = await Promise.race([reduction, racetrackLong])
    }
  } catch (e) {
    _unhookGlobal()
    throw e
  }
  const isStillPending = result === racecar
  const { requests, replies } = _unhookGlobal()

  if (isStillPending && !requests.length) {
    // seems impossible to know if was a native promise, or our promise, until actions are exhausted by replies
    throw new Error(`Wrong type of promise - use "effectInBand(...)"`)
  }
  let isPending = false
  if (!isStillPending) {
    if (typeof result !== 'object') {
      throw new Error(`Must resolve object from tick: ${result}`)
    }
    reduction = result
  } else {
    isPending = true
  }
  return { reduction, isPending, requests, replies }
}
const hook = async (tick, accumulator = [], salt = '_', queries = q) => {
  assert.strictEqual(typeof tick, 'function')
  assert(Array.isArray(accumulator))
  // TODO assert all are rxRequest models
  assert.strictEqual(typeof salt, 'string')
  assert.strictEqual(typeof queries, 'function')

  const requests = []
  const replies = []
  let pending
  let inbandPromises = []
  accumulator = [...accumulator]
  // TODO might be faster rehook as soon as the first promise resolves
  pending = await execute(tick, accumulator, salt)
  const skimPending = (pending) => {
    replies.push(...pending.replies)
    requests.push(...pending.requests.filter((req) => !req.inBand))
    inbandPromises = pending.requests.filter((req) => req.inBand)
  }
  skimPending(pending)
  while (inbandPromises.length) {
    const { isPending } = pending
    assert(isPending, `inband promises must be awaited`)
    const results = await awaitInbandPromises(inbandPromises, queries)

    await _hookGlobal(accumulator, salt) // TODO increment the salt ?
    try {
      settlePromises(inbandPromises, results)
    } catch (e) {
      _unhookGlobal()
      throw e
    }
    pending = await awaitPending(pending) // unhooks global
    skimPending(pending)
  }
  if (pending.isPending) {
    delete pending.reduction
  }
  return { ...pending, requests, replies }
}
const q = (...args) => {
  throw new Error(`No query function for:`, args)
}
const settlePromises = (promises, results) => {
  for (const action of promises) {
    const result = results.shift()
    assert(action.inBand)
    assert.strictEqual(typeof action.resolve, 'function')
    assert.strictEqual(typeof action.reject, 'function')
    if (result.type === '@@RESOLVE') {
      action.resolve(result.payload)
    } else {
      assert.strictEqual(result.type, '@@REJECT')
      action.reject(result.payload)
    }
  }
}
const awaitInbandPromises = async (promises, queries) => {
  // TODO WARNING if call a hook function while another operation has
  // the hook, will interfere
  const awaits = promises.map(async (action) => {
    debug(`inband execution of: `, action.type)
    assert(action.inBand)
    let { exec } = action
    if (action.query) {
      const { type, payload } = action
      exec = () => queries({ type, payload })
    }
    assert.strictEqual(typeof exec, 'function')
    try {
      const payload = await exec()
      return resolve(payload, action)
    } catch (e) {
      debug(`error: `, e)
      return reject(e, action)
    }
  })
  const results = await Promise.all(awaits)
  debug(`inband awaits results: `, results.length)
  return results
}

export {
  replyPromise,
  replyResolve,
  replyReject,
  interchain,
  effect,
  effectInBand,
  query,
  all,
  // TODO move this out of the API
  hook as _hook, // system use only
}
