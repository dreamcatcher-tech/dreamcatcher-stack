import { resolve, reject, isReplyType } from '../../w002-api/src/api'
import { Request, PendingRequest, Reply } from '../../w008-ipld'
import equals from 'fast-deep-equal'
import assert from 'assert-fast'
import callsites from 'callsites'
import Debug from 'debug'

const debug = Debug('interblock:api:callsites')

let invokeId = 0
let activeInvocations = new Map()

/**
 *
 * @param {*} tick
 * @param {*} accumulator
 * @returns { state, error, isPending, txs }
 */
export const wrapReduce = async (tick, accumulator = []) => {
  assert.strictEqual(typeof tick, 'function')
  assert(Array.isArray(accumulator))
  const id = `@@INVOKE\\ ${invokeId++}` // basically just a difficult name
  const wrapper = {
    [id]() {
      const result = tick()
      return result
    },
  }
  const invocation = { accumulator, txs: [] }
  activeInvocations.set(id, invocation)

  try {
    const result = wrapper[id]()
    return await awaitActivity(result, id)
  } catch (error) {
    return { error }
  }
}
const awaitActivity = async (result, id) => {
  if (result !== undefined && typeof result !== 'object') {
    throw new Error(`Must return either undefined, or an object`)
  }
  assert(activeInvocations.has(id))
  const isPending = result && typeof result.then === 'function'
  const { txs } = activeInvocations.get(id)
  if (txs.length || !isPending) {
    if (isPending) {
      return { isPending, txs }
    } else {
      return { state: result, txs }
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
  const { accumulator, txs } = getInvocation()
  if (!accumulator.length) {
    const pendingRequest = PendingRequest.create(request, to)
    txs.push(pendingRequest)
    // TODO early exit for quiting after the first external request
    // race against the event loop, then exit as soon as we have a tx
    // TODO hook .then, so we can know if something *might* be waiting for us
    // otherwise we know that something async is happening that isn't us
    return new Promise(() => Infinity)
  }
  const accumulated = accumulator.shift()
  assert(accumulated instanceof PendingRequest)
  assert(accumulated.isRequestMatch(request))
  assert(accumulated.settled)
  const reply = accumulated.settled
  if (reply.isResolve()) {
    // TODO binary will have to be inserted into the payload ?
    return reply.payload
  } else {
    assert(reply.isRejection())
    throw reply.getRejectionError()
  }
}

const respond = (payload, binary) => {
  const { accumulator, txs } = getInvocation()
  if (txs.some((tx) => tx instanceof Reply)) {
    throw new Error('cannot respond twice')
  }
  const reply = Reply.create('@@RESOLVE', payload, binary)
  if (!accumulator.length) {
    txs.push(reply)
    return
  }
  const accumulated = accumulator.shift()
  assert(accumulated instanceof Reply)
  assert(equals(reply, accumulated))
}

if (globalThis[Symbol.for('interblock:api:hook')]) {
  console.error('interblock:api:hook already defined')
}
globalThis[Symbol.for('interblock:api:hook')] = { interchain, respond }
