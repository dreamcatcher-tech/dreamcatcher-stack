import { request, promise, resolve, reject, isReplyType } from './api'
import assert from 'assert-fast'
import callsites from 'callsites'
import Debug from 'debug'

const debug = Debug('interblock:api:callsites')
// hook global as soon as we are loadedd - throw if double loaded
// api functions should throw if they are loaded without hook being available
// first instance to load secures the global hook - all others should yield

let invokeId = 0
let activeInvocations = new Map()
export const wrapReduce = async (fn, accumulator) => {
  assert.strictEqual(typeof fn, 'function')
  assert(Array.isArray(accumulator))
  const id = `@@INVOKE \\${invokeId}`
  const obj = {
    [id]() {
      return fn()
    },
  }
  const invocation = { accumulator, transmissions: [] }
  activeInvocations.set(id, invocation)

  // run the function
  const result = await obj[id]()
  // determine if we are pending or not
  if (result && typeof result.then === 'function') {
    // if we have any awaited interchains, exit
  } else {
    // else await the results until the timeout occurs
  }
  // but if any interchain comms are received, exit after the next tick

  // OR exit as soon as the first awaited interchain is received ?
}

export const interchainHook = (type, payload, to) => {
  // the version running in our code base
  // use callsites
  const standardRequest = request(type, payload, to)
  assert(standardRequest.to !== '.@@io')

  const stack = callsites()
  stack.reverse()
  let id
  for (const callsite of stack) {
    const name = callsite.getFunctionName()
    if (name.startsWith(`@@INVOKE \\`)) {
      // we have found our hook
      id = name
      break
    }
  }
  if (!id || !activeInvocations.has(id)) {
    const msg = `interchainHook: no hook found for ${type}`
    console.error(msg)
    throw new Error(msg)
  }
  const invocation = activeInvocations.get(id)
  // shift the accumulator
  // if nothing, transmit this request
  // call the wrappers callback, in case it wants to exit now

  // if the .then was actually called, then we at least know that something
  // *might* be awaiting one of our promises
  // otherwise we know that something async is happening that isn't us
}

const interchain = (type, payload, to) => {
  const { interchainHook } = globalThis[Symbol.for('interblock:api:hook')]
  assert(interchainHook)
  return interchainHook(type, payload, to)
}

globalThis[Symbol.for('interblock:api:hook')] = { interchainHook }
const g = globalThis
const h = g[Symbol.for('interblock:api:hook')]
