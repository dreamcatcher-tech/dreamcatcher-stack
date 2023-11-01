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
/**
 * 
 * @param {*} request 
 * @param {*} reducer 
 * @param {*} settles 
 * @returns { reply, txs }

 */
export const wrapReduce = async (trail, reducer, timeout = 500) => {
  assert(trail instanceof AsyncTrail)
  assert(trail.isPending())
  assert(trail.isFulfilled())
  assert.strictEqual(typeof reducer, 'function')
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
  const invocation = { settles, txs, trail }
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
  assert(priorRequest.isRequestMatch(request))
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

const useAsync = async (fn) => {
  assert.strictEqual(typeof fn, 'function', `must supply a function`)
  /**
   * This function gets executed in the context of the isolator.
   * An action is dispatched into io to signal the pending execution.
   * then the function is run
   * the result is then turned into a reply to the original io action
   *
   * does an interchain to the io channel
   * this gets picked up by an external system.
   * Use a weakmap to whisper the function across
   * So in the isolation context, if you are running as the effector,
   * you can then call the function using the weak whisper
   * You would know there was an action to be run, since the pulse will have
   * dangling io actions that are outbound.
   *
   * These outbound actions are detected when the block is completed, and
   * then in order, the actions are pulled out of the whisperer.
   * Once executed, they are removed from the whisperer.
   * Whisperer should store the id as part of the key, so objects can be retrieved
   * Should the actions on the channel always be unique then ?
   *
   * Whisperer could be explicit, such that it is only used when we know we
   * are running as the effector.  In this case, they are just a straight
   * queue of functions to be called, in what order.
   *
   *
   */
  const hash = toHex(sha256(fn.toString()))
  const request = Request.create('@@ASYNC', { hash })
  assert(!asyncWhisper.has(request))
  asyncWhisper.set(request, fn)
  const { result } = await invoke(request, '.@@io')
  return result
}
const asyncWhisper = new WeakMap() // actions to functions
export const popAsyncWhisper = (request) => {
  assert(request instanceof Request)
  assert(asyncWhisper.has(request))
  const fn = asyncWhisper.get(request)
  asyncWhisper.delete(request)
  return fn
}
import { sha256 } from '@noble/hashes/sha256' // ECMAScript modules (ESM) and Common.js
import { bytesToHex as toHex } from '@noble/hashes/utils'

const useState = async (path) => {
  assert.strictEqual(typeof path, 'string', `path must be a string`)
  assert(path, `path cannot be null`)
  const getState = Request.createGetState(path)
  const { state } = await interchain(getState)
  const setState = (nextState) => {
    if (typeof nextState !== 'object') {
      throw new Error(`state must be an object, but was: ${typeof nextState}`)
    }
    if (equals(nextState, state)) {
      return
    }
    const setStateRequest = Request.createSetState(nextState)
    return interchain(setStateRequest, path)
  }
  return [state, setState]
}

if (globalThis[Symbol.for('interblock:api:hook')]) {
  console.error('interblock:api:hook already defined')
  throw new Error('interblock:api:hook already defined')
}
globalThis[Symbol.for('interblock:api:hook')] = {
  interchain,
  useState,
  useAsync,
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
