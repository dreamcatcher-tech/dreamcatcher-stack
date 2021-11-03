import assert from 'assert-fast'
import setImmediate from 'set-immediate-shim'
import { request, promise, resolve, reject, isReplyType } from './api'
import Debug from 'debug'
import { dmzModel, rxReplyModel } from '../../w015-models'
const debug = Debug('interblock:api:hooks')

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

  const payload = { args }
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
const _promise = (requestRaw) => {
  debug(`_promise request.type: %o`, requestRaw.type)
  const { type, payload, to, exec, inBand, query } = requestRaw
  assert(!exec || typeof exec === 'function')
  const request = { type, payload, to }

  const [previousType, previousTo, reply] = _shiftAccumulator()
  if (previousType) {
    assert(!isReplyType(type))
    assert.strictEqual(type, previousType, `Different request after replay`)
    assert.strictEqual(to, previousTo, `Different request after replay`)
    if (reply) {
      assert(rxReplyModel.isModel(reply))
      if (reply.type === '@@RESOLVE') {
        return reply.payload
      }
      assert.strictEqual(reply.type, '@@REJECT')
      throw reply.payload
    }
    return new Promise() // never resolve as already processed this request
  }
  const promise = new Promise((resolve, reject) => {
    // TODO allow direct resolving of interchain promises between block boundaries
    request.resolve = resolve
    request.reject = reject
  })
  if (exec) {
    // TODO somehow handle inband promises without hook ever async waiting
    request.exec = exec
    request.inBand = inBand
  }
  if (query) {
    request.inBand = inBand
    request.query = query
  }
  _pushGlobalRequest(request)
  return promise
}
/**
 * TODO To make multiple hooks that are concurrent and do not rely on being
 * the same piece of code as what the hooks function is calling,
 * each API function shall have a symbol that it generated, and passes
 * down as an arg, so when global is hooked, can be separated by symbol
 * as a queue identifier, eliminating the need to wait for global.
 *
 * OR rely on running single threaded so we are always in charge of the global ?
 */
const _hookGlobal = async (accumulator) => {
  assert(Array.isArray(accumulator))
  globalThis['@@interblock'] = globalThis['@@interblock'] || {}
  const start = Date.now()
  // TODO make this be a queue, shared by all, so zero event loops
  while (globalThis['@@interblock'].promises) {
    await new Promise(setImmediate)
  }
  const msg = `waited for global for ${Date.now() - start}ms`
  debug(msg)
  assert(!globalThis['@@interblock'].promises, msg)
  accumulator = [...accumulator]
  const promises = { accumulator, transmissions: [] }
  globalThis['@@interblock'].promises = promises
}
const _unhookGlobal = () => {
  _assertGlobals()
  const { transmissions } = globalThis['@@interblock'].promises
  delete globalThis['@@interblock'].promises
  return { transmissions }
}
const _shiftAccumulator = () => {
  _assertGlobals()
  debug(`_shiftAccumulator`)
  const { promises } = globalThis['@@interblock']
  const { accumulator } = promises
  if (!accumulator.length) {
    return []
  }
  const { type, to, reply } = accumulator.shift()
  return [type, to, reply]
}
const _pushGlobalRequest = (request) => {
  _assertGlobals()
  debug(`_pushGlobalRequest`, request.type)
  const { transmissions } = globalThis['@@interblock'].promises
  transmissions.push(request)
}
const _pushGlobalReply = (reply) => {
  _assertGlobals()
  const [previousType] = _shiftAccumulator()
  if (previousType) {
    assert(isReplyType(previousType))
    assert.strictEqual(reply.type, previousType, `Different reply after replay`)
  }
  const { transmissions } = globalThis['@@interblock'].promises
  debug(`_pushGlobalReply`, reply.type)
  transmissions.push(reply)
}
const _assertGlobals = () => {
  assert(globalThis['@@interblock'])
  assert(globalThis['@@interblock'].promises)
  const { accumulator, transmissions } = globalThis['@@interblock'].promises
  assert(Array.isArray(accumulator))
  assert(Array.isArray(transmissions))
}
// and now for the tricky part...
const execute = async (tick, accumulator) => {
  debug(`execute`)
  assert(Array.isArray(accumulator))
  await _hookGlobal(accumulator)
  let pending
  try {
    let reduction = tick()
    if (typeof reduction !== 'object') {
      throw new Error(`Must return object from tick: ${reduction}`)
    }
    const isPending = typeof reduction.then === 'function'
    pending = { reduction, isPending, transmissions: [] }
  } catch (error) {
    debug(`error: `, error)
    _unhookGlobal()
    throw error
  }
  if (pending.isPending) {
    pending = await awaitPending(pending)
  } else {
    const { transmissions } = _unhookGlobal()
    pending.transmissions = transmissions
  }
  if (pending.isPending) {
    delete pending.reduction
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
  const { transmissions } = _unhookGlobal()

  if (isStillPending && !transmissions.length) {
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
  return { reduction, isPending, transmissions }
}
const hook = async (tick, accumulator = [], queries = q) => {
  assert.strictEqual(typeof tick, 'function')
  assert(Array.isArray(accumulator))
  assert.strictEqual(typeof queries, 'function')

  const pending = await execute(tick, accumulator) //?
  return pending
}
const q = (...args) => {
  throw new Error(`No query function for:`, args)
}

const inbandPromises = async () => {
  // TODO migrate to new model of transmissions and accumulator
  // may do at same time as making all hooked actions be synchronous
  // TODO might be faster rehook as soon as the first promise resolves
  let inbandPromises = []
  const transmissions = []
  const skimPending = (pending) => {
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
  // TODO move this out of the API
  hook as _hook, // system use only
}
