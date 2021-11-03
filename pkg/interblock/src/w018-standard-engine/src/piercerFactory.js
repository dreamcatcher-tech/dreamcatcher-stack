import assert from 'assert-fast'
import { deserializeError } from 'serialize-error'
import { v4 as uuid } from 'uuid'
import { request } from '../../w002-api'
import { txRequestModel } from '../../w015-models'
import { toFunctions } from './services/consistencyFactory'
import Debug from 'debug'
const debug = Debug('interblock:engine:piercerFactory')

const piercerFactory = (address, ioConsistency, sqsIncrease) => {
  const promises = new Map()
  const id = uuid()
  let dispatchCounter = 0

  const consistency = toFunctions(ioConsistency)
  ioConsistency.subscribe(async (action, queuePromise) => {
    if (action.type === 'UNLOCK') {
      // await queuePromise // TODO check if any faster ?
      const { block } = action.payload
      if (block.getChainId() === address.getChainId()) {
        const ioChannel = block.network['.@@io']
        if (!ioChannel) {
          return
        }
        if (block.piercings) {
          const height = ioChannel.tipHeight
          assert(Number.isInteger(height) && height >= 0)
          block.piercings.requests.forEach((request, index) => {
            const replyKey = `${height}_${index}`
            for (const [ioSequence, callbacks] of promises) {
              if (request.payload['__@@ioSequence'] === ioSequence) {
                assert(ioSequence.endsWith(id))
                callbacks.replyKey = replyKey
              }
            }
          })
        }
        const { replies } = ioChannel
        for (const [ioSequence, callbacks] of promises) {
          if (callbacks.replyKey) {
            const reply = replies[callbacks.replyKey]
            if (!reply || reply.isPromise()) {
              continue
            }
            const { resolve, reject } = callbacks
            promises.delete(ioSequence)
            if (reply.isResolve()) {
              const { '__@@ioSequence': discard, ...payload } = reply.payload
              assert.strictEqual(typeof payload, 'object')
              resolve(payload)
            } else {
              reject(deserializeError(reply.payload))
            }
          }
        }
      }
    }
  })

  let pendingCount = 0

  const pierce = async (rawType, rawPayload) => {
    let { type, payload = {} } = request(rawType, rawPayload)
    assert(!payload['__@@ioSequence'])
    const ioSequence = `${dispatchCounter++} ${id}`
    debug(`pierce: %s id: %o`, type, ioSequence)

    payload = { ...payload, '__@@ioSequence': ioSequence }
    const chainId = address.getChainId()
    const txRequest = txRequestModel.create(type, payload, chainId)
    const { promise, callbacks } = generateDispatchPromise()
    promises.set(ioSequence, callbacks)
    const updatePending = async () => {
      if (pendingCount === 0) {
        const pendingSwitchingHigh = true
        subscribers.forEach((cb) => cb(pendingSwitchingHigh))
      }
      pendingCount++
      try {
        await promise
      } catch (e) {
        // we care only about the promise being unsettled, not how it settled
      }
      pendingCount--
      assert(pendingCount >= 0)
      if (pendingCount === 0) {
        const pendingSettled = false
        subscribers.forEach((cb) => cb(pendingSettled))
      }
    }
    updatePending()
    await consistency.putPierceRequest({ txRequest })
    await sqsIncrease.pushDirect(address) // pushDirect to surface rejections
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
  let callbacks = {}
  const promise = new Promise((resolve, reject) => {
    callbacks = { resolve, reject }
  })
  return { promise, callbacks }
}

export { piercerFactory }
