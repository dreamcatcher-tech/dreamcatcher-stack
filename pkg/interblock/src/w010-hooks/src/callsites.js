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
 * If a throw occurs at any point, only the `error` key is returned.
 * If the function is pending, then only `txs` key is returned.
 * If the function has settled with no reply, only the `state` key is returned.
 * If the function has settled with a reply, both `state` and `reply` key return
 *
 * It is an error to return `reply` but no `state`
 *
 * This structure is used in ipld schema to store the pending states.
 *
 * ? can remove the error key if we use reply to hold the error ?
 * it is useful to return a state, and some txs, and reject as well
 *
 * @param {*} tick
 * @param {*} asyncs
 * @returns { state, reply, txs }
 */
export const wrapReduce = async (request, reducer, asyncs = []) => {
  assert(request instanceof Request)
  assert.strictEqual(typeof reducer, 'function')
  assert(Array.isArray(asyncs))
  assert(asyncs.every((async) => async instanceof AsyncRequest))
  assert(asyncs.every((async) => async.isSettled()))
  const id = `@@INVOKE\\ ${invokeId++}` // basically just a difficult name
  const wrapper = {
    [id]() {
      const pojo = request.getAction()
      const result = reducer(pojo)
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
    const { txs, state } = activeInvocations.get(id)

    return Reduction.createError(error, state, txs)
  }
}
const awaitActivity = async (result, id) => {
  if (result !== undefined && typeof result !== 'object') {
    throw new Error(`Must return either undefined, or an object`)
  }
  assert(activeInvocations.has(id))
  const isPending = result && typeof result.then === 'function'
  const { txs, reply } = activeInvocations.get(id)
  if (txs.length || !isPending) {
    if (isPending) {
      return Reduction.createPending(txs)
    } else {
      return Reduction.createResolve(result, txs, reply)
    }
  } else {
    const racecar = Symbol()
    const timeout = 500
    const racecarPromise = new Promise((resolve) => {
      setTimeout(() => resolve(racecar), timeout)
    })
    const nextResult = await Promise.race([racecarPromise, result])
    if (nextResult === racecar) {
      throw new Error(`timeout exceeded: ${timeout} ms`)
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
      // we have found our hook
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
  // handle all kinds of shorthands from the devs
  const request = Request.create(type, payload, binary)
  assert(to !== '.@@io')
  const { settles, txs } = getInvocation()
  if (!settles.length) {
    const pendingRequest = PendingRequest.create(request, to)
    txs.push(pendingRequest)
    // TODO early exit for quiting after the first external request
    // race against the event loop, then exit as soon as we have a tx
    // TODO hook .then, so we can know if something *might* be waiting for us
    // otherwise we know that something async is happening that isn't us
    return new Promise(() => Infinity)
  }
  const prior = settles.shift()
  assert(prior instanceof PendingRequest)
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

const respond = (payload, binary) => {
  const { settles, txs } = getInvocation()
  if (txs.some((tx) => tx instanceof Reply)) {
    throw new Error('cannot respond twice')
  }
  const reply = Reply.create('@@RESOLVE', payload, binary)
  if (!settles.length) {
    txs.push(reply)
    return
  }
  const prior = settles.shift()
  assert(prior instanceof Reply)
  assert(equals(reply, prior))
}

if (globalThis[Symbol.for('interblock:api:hook')]) {
  console.error('interblock:api:hook already defined')
}
globalThis[Symbol.for('interblock:api:hook')] = { interchain, respond }
