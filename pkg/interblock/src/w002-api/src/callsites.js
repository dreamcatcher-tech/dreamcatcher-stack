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
export const wrapReduce = async (tick, accumulator = []) => {
  assert.strictEqual(typeof tick, 'function')
  assert(Array.isArray(accumulator))
  const id = `@@INVOKE\\ ${invokeId++}` // basicaly just a difficult name
  const wrapper = {
    async [id]() {
      return await tick()
    },
  }
  const invocation = { accumulator, transmissions: [] }
  activeInvocations.set(id, invocation)

  // run the function
  const result = wrapper[id]()
  // determine if we are pending or not
  return await awaitActivity(result, id)
}
const awaitActivity = async (result, id) => {
  assert.strictEqual(typeof result, 'object', `Must return object from reducer`)
  assert(activeInvocations.has(id))
  const isPending = typeof result.then === 'function'
  const { transmissions } = activeInvocations.get(id)
  if (transmissions.length || !isPending) {
    return { result, txs: transmissions }
  } else {
    // TODO  await the results until the timeout occurs
    // or as soon as we regain the thread and some interchains are unresolved
    const nextResult = await result
    return awaitActivity(nextResult, id)
  }
}

export const interchainHook = (type, payload, to) => {
  // the version running in our code base
  // use callsites
  const action = request(type, payload, to)
  assert(action.to !== '.@@io')

  const stack = callsites()
  stack.reverse()
  let id
  for (const callsite of stack) {
    const name = callsite.getFunctionName()
    if (name && name.startsWith(`@@INVOKE\\ `)) {
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
  debug(invocation, id)
  const accumulated = shiftAccumulator()
  if (!accumulated) {
    invocation.transmissions.push(action)
    return new Promise(() => Infinity)
  }
  // shift the accumulator
  // if nothing, transmit this request
  // call the wrappers callback, in case it wants to exit now
  // early exit for when we are quitring after the first external request

  // if the .then was actually called, then we at least know that something
  // *might* be awaiting one of our promises
  // otherwise we know that something async is happening that isn't us
}

// TODO error if promise called more than once
export const replyPromise = () => pushReply(promise())
// TODO error if resolve against the same request more than once, which includes default action
export const replyResolve = (payload, identifier) =>
  pushReply(resolve(payload, identifier))
export const replyReject = (error, identifier) =>
  pushReply(reject(error, identifier))

const shiftAccumulator = () => {
  debug(`shiftAccumulator`)
}
const pushReply = (reply) => {
  const [previousType] = shiftAccumulator()
  if (previousType) {
    assert(isReplyType(previousType))
    assert.strictEqual(reply.type, previousType, `Different reply after replay`)
  }
  const { transmissions } = globalThis['@@interblock'].promises
  debug(`_pushGlobalReply`, reply.type)
  transmissions.push(reply)
}

export const interchain = (type, payload, to) => {
  const { interchainHook } = globalThis[Symbol.for('interblock:api:hook')]
  assert(interchainHook)
  return interchainHook(type, payload, to)
}

globalThis[Symbol.for('interblock:api:hook')] = { interchainHook }
