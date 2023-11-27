import {
  Request,
  AsyncRequest,
  Reply,
  AsyncTrail,
  Pulse,
} from '../../w008-ipld/index.mjs'
import equals from 'fast-deep-equal'
import assert from 'assert-fast'
import callsites from 'callsites'
import Debug from 'debug'

const debug = Debug('interblock:api:callsites')

let invokeId = 0
let activeInvocations = new Map()

export const wrapReduceEffects = async (trail, reducer, whisper, timeout) => {
  assert(whisper instanceof Map)
  return _wrapReduce(trail, reducer, whisper, timeout)
}

export const wrapReduce = async (trail, reducer, timeout) => {
  const discardedWhisper = undefined
  return _wrapReduce(trail, reducer, discardedWhisper, timeout)
}
const _wrapReduce = async (trail, reducer, whisper, timeout = 500) => {
  assert(trail instanceof AsyncTrail)
  assert(trail.isPending())
  assert(trail.isFulfilled())
  assert.strictEqual(typeof reducer, 'function')
  assert(!whisper || whisper instanceof Map)
  assert.strictEqual(typeof timeout, 'number')
  assert(timeout > 0)

  const id = `@@INVOKE\\ ${invokeId++}` // basically just a difficult name
  const wrapper = {
    async [id]() {
      const request = trail.getRequestObject()
      const result = await reducer(request)
      return result
    },
  }
  const settles = trail.getSettles()
  const txs = []
  const invocation = { settles, txs, trail, whisper }
  activeInvocations.set(id, invocation)

  try {
    const result = wrapper[id]()
    return await awaitActivity(result, id, timeout)
  } catch (error) {
    const { txs } = activeInvocations.get(id)
    return trail.setError(txs, error)
  }
}
const awaitActivity = async (result, id, timeout) => {
  if (result !== undefined && typeof result !== 'object') {
    // TODO relax this contstraint to allow primitives
    throw new Error(`Must return either undefined, or an object`)
  }
  assert(activeInvocations.has(id))
  const isPending = result && typeof result.then === 'function'
  const invocation = activeInvocations.get(id)
  const { txs, trail } = invocation
  if (txs.length || !isPending) {
    if (isPending) {
      return trail.setTxs(txs)
    } else {
      let reply
      if (trail.origin.request.isPulse()) {
        assert(result instanceof Pulse)
        reply = Reply.createPulse(result)
      } else {
        reply = Reply.createResolve(result)
      }
      return trail.setTxs(txs).settleOrigin(reply)
    }
  } else {
    const racecarSymbol = Symbol()
    const ripcordSymbol = Symbol()
    let timeoutId
    const racecar = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(racecarSymbol), timeout)
    })
    const ripcord = new Promise(
      (resolve) => (invocation.ripcord = () => resolve(ripcordSymbol))
    )
    const nextResult = await Promise.race([racecar, result, ripcord])
    clearTimeout(timeoutId)
    if (nextResult === racecarSymbol) {
      throw new Error(`timeout exceeded: ${timeout} ms`)
    }
    if (nextResult === ripcordSymbol) {
      return awaitActivity(result, id)
    }
    return awaitActivity(nextResult, id)
  }
}
const getInvocation = () => {
  const { stackTraceLimit } = Error
  Error.stackTraceLimit = Infinity // nodejs usually defaults to 100
  const stack = callsites()
  Error.stackTraceLimit = stackTraceLimit
  let invokeId
  for (const callsite of stack) {
    const name = callsite.getFunctionName()
    if (name && name.startsWith(`@@INVOKE\\ `)) {
      invokeId = name
      break
    }
  }
  if (!invokeId || !activeInvocations.has(invokeId)) {
    const msg = `interchain: no active invocation found for ${invokeId}`
    console.error(msg)
    throw new Error(msg)
  }
  return activeInvocations.get(invokeId)
}
const interchain = (type, payload, to, binary) => {
  let request
  if (type instanceof Request) {
    request = type
    binary = to
    to = payload
  } else {
    if (type.type && type.payload) {
      binary = to
      to = payload
      payload = type.payload
      type = type.type
    }
    request = Request.create(type, payload, binary)
  }
  to = to || '.'
  assert(to !== '.@@io')
  return invoke(request, to)
}
const invoke = (request, to) => {
  const { settles, txs, ripcord } = getInvocation()
  if (!settles.length) {
    if (ripcord) {
      ripcord()
    }
    const asyncRequest = AsyncRequest.create(request, to)
    txs.push(asyncRequest)
    return new Promise(() => Infinity)
  }
  const priorRequest = settles.shift()
  assert(priorRequest instanceof AsyncRequest)
  assert(priorRequest.isRequestMatch(request), `Requests differ`)
  assert(priorRequest.settled)
  const reply = priorRequest.settled
  if (reply.isResolve()) {
    // TODO binary will have to be inserted into the payload ?
    return reply.payload
  } else {
    assert(reply.isRejection())
    throw reply.getRejectionError()
  }
}
const useAsync = async (fn, key = '') => {
  assert.strictEqual(typeof fn, 'function', `must supply a function`)
  assert.strictEqual(typeof key, 'string', `key must be a string`)
  assert(key, `key cannot be nullish`)

  // TODO find how to tolerate no key being sent in - must be deterministic
  // use the requestId as one key, but also attach a user defined key
  // Use an array instead, and use the originating request id as
  // a mapping so the caller can get access to the array index if needed.
  // a tree structure should emerge where a single trigger can make more than
  // one action that results.
  // This status tracking can be used for both chainland and async actions
  // can help the UI show richer information about where the process is up to
  // Effectively surfaces the supervisor tree.

  const request = Request.create('@@ASYNC', { key })
  // TODO if we are not to execute these effects, then do not whisper them
  const { whisper } = getInvocation()
  if (!(whisper instanceof Map)) {
    throw new Error(`Chain is not side effect capable`)
  }
  whisper.set(key, fn)
  const { result } = await invoke(request, '.@@io')
  return result
}

const useState = async (path) => {
  assert.strictEqual(typeof path, 'string', `path must be a string`)
  assert(path, `path cannot be null`)
  const getState = Request.createGetState(path)
  let { state } = await interchain(getState)
  const setState = (changes) => {
    if (typeof changes !== 'object') {
      throw new Error(`state must be an object, but was: ${typeof changes}`)
    }
    const nextState = { ...state, ...changes }
    if (equals(nextState, state)) {
      return
    }
    const setStateRequest = Request.createSetState(nextState)
    state = interchain(setStateRequest, path)
    return state
  }
  return [state, setState]
}

const useAI = async (path) => {
  assert.strictEqual(typeof path, 'string', `path must be a string`)
  assert(path, `path cannot be null`)
  const getAI = Request.createGetAI(path)
  const { ai } = await interchain(getAI)
  const setAI = (nextAi) => {
    if (typeof nextAi !== 'object') {
      throw new Error(`AI must be an object, but was: ${typeof nextAi}`)
    }
    if (equals(nextAi, ai)) {
      return
    }
    const setAIRequest = Request.createSetAI(nextAi)
    return interchain(setAIRequest, path)
  }
  return [ai, setAI]
}
// TODO switch to a general form for modifying all slices of a pulse
const useCovenant = async (path) => {
  // WARNING THIS IS NOT FINISHED
  assert.strictEqual(typeof path, 'string', `path must be a string`)
  assert(path, `path cannot be null`)
  const getAI = Request.createGetAI(path)
  const { ai } = await interchain(getAI)
  const setAI = (nextAi) => {
    if (typeof nextAi !== 'object') {
      throw new Error(`AI must be an object, but was: ${typeof nextAi}`)
    }
    if (equals(nextAi, ai)) {
      return
    }
    const setAIRequest = Request.createSetAI(nextAi)
    return interchain(setAIRequest, path)
  }
  return [ai, setAI]
}

if (globalThis[Symbol.for('interblock:api:hook')]) {
  console.error('interblock:api:hook already defined')
  throw new Error('interblock:api:hook already defined')
}
globalThis[Symbol.for('interblock:api:hook')] = {
  interchain,
  useState,
  useAsync,
  useAI,
}

export const usePulse = () => {
  // only used by the system reducer
  const invocation = getInvocation()
  const { settles, txs, ripcord, trail } = invocation
  assert(!txs.length)
  assert(!settles.length)
  assert(!ripcord)
  assert(trail instanceof AsyncTrail)
  const { pulse } = trail
  assert(pulse instanceof Pulse)

  const setPulse = (nextPulse) => {
    assert(nextPulse instanceof Pulse)
    assert(nextPulse !== pulse, `no change`)
    assert.strictEqual(trail, invocation.trail)
    invocation.trail = trail.setMap({ pulse: nextPulse })
  }
  const { latest } = trail
  assert.strictEqual(typeof latest, 'function')
  return [pulse, setPulse, latest]
}
