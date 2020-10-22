const assert = require('assert')
const { v4: uuid } = require('uuid')
const debug = require('debug')('interblock:engine:piercerFactory')
const { isReplyFor, request } = require('../../w002-api')
const { actionModel } = require('../../w015-models')
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
        debug(`new block`)
        const ioChannel = block.network['@@io']
        assert(ioChannel)
        const indices = ioChannel.getRemoteRequestIndices()
        indices.forEach((index) => {
          const request = ioChannel.getRemote().requests[index]
          assert(request)
          const { _dispatchId } = request.payload
          assert(_dispatchId.endsWith(id))
          if (!promises.has(_dispatchId)) {
            return
          }
          const callbacks = promises.get(_dispatchId)
          callbacks.pending.resolve()

          const reply = ioChannel.replies[index]
          if (!reply || reply.isPromise()) {
            return
          }
          const { resolve, reject } = callbacks.settled
          const settler = reply.isResolve() ? resolve : reject
          setImmediate(() => settler(reply.payload))
          promises.delete(_dispatchId)
        })
      }
    }
  })

  return async ({ type, payload = {} }) => {
    const _dispatchId = `${dispatchCounter++} ${id}`
    debug(`pierce: %s id: %o`, type, _dispatchId)

    payload = { ...payload, _dispatchId }
    const action = actionModel.create({ type, payload })
    const { promise, callbacks } = generateDispatchPromise()
    promises.set(_dispatchId, callbacks)
    await consistency.putPierceRequest({ address, action })
    await sqsIncrease.push(address)

    return promise
  }
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
