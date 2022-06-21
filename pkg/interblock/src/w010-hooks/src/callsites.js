import { Request, AsyncRequest, Reply } from '../../w008-ipld'
import equals from 'fast-deep-equal'
import assert from 'assert-fast'
import callsites from 'callsites'
import { Reduction } from '..'
import Debug from 'debug'

const debug = Debug('interblock:api:callsites')

let invokeId = 0
let activeInvocations = new Map()
/**
 * 
 * @param {*} request 
 * @param {*} reducer 
 * @param {*} asyncs 
 * @returns { reply, txs }

 */
export const wrapReduce = async (request, reducer, asyncs = []) => {
  assert(request instanceof Request)
  assert.strictEqual(typeof reducer, 'function')
  assert(Array.isArray(asyncs))
  assert(asyncs.every((async) => async instanceof AsyncRequest))
  assert(asyncs.every((async) => async.isSettled()))
  asyncs = [...asyncs]
  const id = `@@INVOKE\\ ${invokeId++}` // basically just a difficult name
  const wrapper = {
    async [id]() {
      const result = await reducer(request)
      return result
    },
  }
  const txs = []
  // TODO should this be passed in, or intercepted from loopback settles ?
  const invocation = { asyncs, txs }
  activeInvocations.set(id, invocation)

  try {
    const result = wrapper[id]()
    return await awaitActivity(result, id)
  } catch (error) {
    const { txs } = activeInvocations.get(id)
    return Reduction.createError(txs, error)
  }
}
const awaitActivity = async (result, id) => {
  if (result !== undefined && typeof result !== 'object') {
    throw new Error(`Must return either undefined, or an object`)
  }
  assert(activeInvocations.has(id))
  const isPending = result && typeof result.then === 'function'
  const invocation = activeInvocations.get(id)
  const { txs } = invocation
  if (txs.length || !isPending) {
    if (isPending) {
      return Reduction.createPending(txs)
    } else {
      const reply = Reply.create('@@RESOLVE', result)
      return Reduction.createResolve(txs, reply)
    }
  } else {
    const racecarSymbol = Symbol()
    const ripcordSymbol = Symbol()
    const timeout = 100
    const racecar = new Promise((resolve) =>
      setTimeout(() => resolve(racecarSymbol), timeout)
    )
    const ripcord = new Promise(
      (resolve) => (invocation.ripcord = () => resolve(ripcordSymbol))
    )
    const nextResult = await Promise.race([racecar, result, ripcord])
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
  Error.stackTraceLimit = Infinity
  const stack = callsites()
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
const interchain = (type, payload, to = '.', binary) => {
  const request = Request.create(type, payload, binary)
  assert(to !== '.@@io')
  const { asyncs, txs, ripcord } = getInvocation()
  if (!asyncs.length) {
    if (ripcord) {
      ripcord()
    }
    const asyncRequest = AsyncRequest.create(request, to)
    txs.push(asyncRequest)
    // TODO hook .then, so we can know if something *might* be waiting for us
    // otherwise we know that something async is happening that isn't us
    return new Promise(() => Infinity)
  }
  const prior = asyncs.shift()
  assert(prior instanceof AsyncRequest)
  assert(prior.isRequestMatch(request))
  assert(prior.settled)
  const reply = prior.settled
  if (reply.isResolve()) {
    // TODO binary will have to be inserted into the payload ?
    return reply.payload
  } else {
    assert(reply.isRejection())
    throw reply.getRejectionError()
  }
}

const useState = async (path) => {
  assert.strictEqual(typeof path, 'string', `path must be a string`)
  assert(path, `path cannot be null`)
  const getState = Request.createGetState(path)
  const state = await interchain(getState)
  const setState = (nextState) => {
    if (typeof nextState !== 'object') {
      throw new Error(`state must be an object, but was: ${typeof nextState}`)
    }
    if (nextState === state) {
      return
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
}
globalThis[Symbol.for('interblock:api:hook')] = { interchain, useState }
