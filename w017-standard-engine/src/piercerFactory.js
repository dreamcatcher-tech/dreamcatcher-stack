const assert = require('assert')
const { deserializeError } = require('serialize-error')
const { v4: uuid } = require('uuid')
const debug = require('debug')('interblock:engine:piercerFactory')
const { request } = require('../../w002-api')
const { txRequestModel } = require('../../w015-models')
const { toFunctions } = require('./services/consistencyFactory')

const piercerFactory = (address, ioConsistency, sqsIncrease) => {
  const promises = new Map()
  const id = uuid()
  let dispatchCounter = 0

  const consistency = toFunctions(ioConsistency)
  ioConsistency.subscribe(async (action, queuePromise) => {
    if (action.type === 'UNLOCK') {
      await queuePromise
      const { block } = action.payload
      if (block.getChainId() === address.getChainId()) {
        const ioChannel = block.network['.@@io']
        if (!ioChannel) {
          return
        }
        const indices = ioChannel.getRemoteRequestIndices()
        indices.forEach((index) => {
          const request = ioChannel.getRemote().requests[index]
          assert(request)
          const { '__@@ioSequence': sequence } = request.payload
          assert(sequence.endsWith(id))
          if (!promises.has(sequence)) {
            return
          }
          const callbacks = promises.get(sequence)
          callbacks.pending.resolve()

          const reply = ioChannel.replies[index]
          if (!reply || reply.isPromise()) {
            return
          }
          const { resolve, reject } = callbacks.settled
          if (reply.isResolve()) {
            const { '__@@ioSequence': discard, ...payload } = reply.payload
            assert.strictEqual(typeof payload, 'object')
            setImmediate(() => resolve(payload))
          } else {
            setImmediate(() => reject(deserializeError(reply.payload)))
          }
          promises.delete(sequence)
        })
      }
    }
  })

  let pendingCount = 0

  const pierce = async (rawType, rawPayload) => {
    let { type, payload = {} } = request(rawType, rawPayload)
    assert(!payload['__@@ioSequence'])
    const sequence = `${dispatchCounter++} ${id}`
    debug(`pierce: %s id: %o`, type, sequence)

    payload = { ...payload, '__@@ioSequence': sequence }
    const chainId = address.getChainId()
    const txRequest = txRequestModel.create(type, payload, chainId)
    const { promise, callbacks } = generateDispatchPromise()
    promises.set(sequence, callbacks)
    const updatePending = async () => {
      if (!pendingCount) {
        subscribers.forEach((cb) => cb(true))
      }
      pendingCount++
      await promise
      pendingCount--
      assert(pendingCount >= 0)
      if (pendingCount === 0) {
        subscribers.forEach((cb) => cb(false))
      }
    }
    updatePending()
    await consistency.putPierceRequest({ txRequest })
    await sqsIncrease.push(address)
    return promise
  }
  const subscribers = new Set()
  pierce.subscribePending = (callback) => {
    subscribers.add(callback)
    callback(pendingCount > 0)
    return () => subscribers.delete(callback)
  }
  return pierce
}
const generateDispatchPromise = () => {
  const callbacks = {}
  const promise = new Promise((resolve, reject) => {
    callbacks.settled = { resolve, reject }
  })
  promise.pending = new Promise((resolve, reject) => {
    callbacks.pending = { resolve, reject }
  })
  return { promise, callbacks }
}

module.exports = { piercerFactory }
