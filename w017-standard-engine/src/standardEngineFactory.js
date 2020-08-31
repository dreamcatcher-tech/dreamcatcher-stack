const assert = require('assert')
const _ = require('lodash')
const { sqsQueueFactory } = require('../../w003-queue')
const {
  interblockModel,
  addressModel,
  txModel,
  socketModel,
} = require('../../w015-models')
const { fsmFactory } = require('./fsmFactory')
const debug = require('debug')('interblock:stdeng')

/**
 * Takes the finite state machines and connects them up using queues.
 * The queues are processed by the pooler and increasor processors defined here.
 * The sqs queues are created here, which are tapped by aws.
 * sqs queues threadbreak, in that they cannot be awaited on for a result.
 */
const standardEngineFactory = () => {
  debug(`standardEngineFactory`)

  const receiver = (ioReceive, sqsPool, sqsTransmit) => async (tx) => {
    debug(`receiver`)
    assert(txModel.isModel(tx))
    const { interblock } = tx
    const { isPoolable, isCatchupable } = await ioReceive.push(tx)
    assert(typeof isPoolable === 'boolean')
    assert(typeof isCatchupable === 'boolean')

    const awaits = []
    if (isPoolable) {
      awaits.push(sqsPool.push(interblock))
    }
    if (isCatchupable) {
      // TODO divert this to the Catcher, to determine if catchup required
      awaits.push(sqsTransmit.push(interblock))
    }
    await Promise.all(awaits)
  }
  const transmitter = (ioTransmit, sqsTx, sqsPool) => async (interblock) => {
    debug(`transmitter`)
    assert(interblockModel.isModel(interblock))
    // TODO split into multiple calls, so can push out earlier
    const transmissions = await ioTransmit.push(interblock)
    assert(transmissions.every(txModel.isModel), `failed transmitter`)
    const awaits = transmissions.map((tx) => {
      const { interblock, socket } = tx
      if (socket.getIsInternal()) {
        return sqsPool.push(interblock)
      } else {
        // should this tear down sockets if info is bad ?
        return sqsTx.push(tx)
      }
    })
    await Promise.all(awaits)
  }

  const pooler = (ioPool, sqsIncrease) => async (interblock) => {
    debug(`pooler`)
    assert(interblockModel.isModel(interblock))
    const affectedAddresses = await ioPool.push(interblock)
    assert(Array.isArray(affectedAddresses), `failed pool`)
    debug(`affectedAddresses length: %o`, affectedAddresses.length)
    const awaits = affectedAddresses.map((address) => sqsIncrease.push(address))
    await Promise.all(awaits)
    return affectedAddresses // sqsPool.push( interblock ) returns affectedAddresses
  }

  // TODO test behaviour independently, concurrent - maybe with dirty queues ?
  // TODO generalize the throttling function
  const increasor = (ioIncrease, sqsTransmit, sqsIncrease) => {
    const lockStack = new Map()

    const throttler = async (address) => {
      assert(addressModel.isModel(address))
      debug(`throttler`)

      const stack = lockStack.get(address) || []
      lockStack.set(address, stack)

      if (stack.length >= 2) {
        debug(`dropped:   %o`, address.getChainId())
        return
      }
      const promise = new Promise((resolve) => {
        stack.push(resolve)
      })
      if (stack.length === 1) {
        stackReduce(address, stack)
      }
      return promise
    }
    const stackReduce = async (address, stack) => {
      while (stack.length) {
        const resolve = stack[0]
        const transmissions = await increase(address, ioIncrease)
        if (!transmissions) {
          debug(`redrive:   %o`, address.getChainId())
          await sqsIncrease.push(address)
          stack.length = 0
        }
        debug(`increased: %o`, address.getChainId())
        stack.shift()
        resolve(transmissions)
      }
      lockStack.delete(address)
    }
    const increase = async (address, ioIncrease) => {
      // TODO maybe move to independent queue
      const transmissions = await ioIncrease.push(address)
      if (transmissions) {
        assert(Array.isArray(transmissions))
        assert(transmissions.every(interblockModel.isModel))
        debug(`transmission count: ${transmissions.length}`)
        const awaits = transmissions.map((interblock) =>
          sqsTransmit.push(interblock)
        )
        await Promise.all(awaits)
        // TODO see if can speed up by increasing next block before this completes ?
      } else {
        debug(`no increase occured for ${address.getChainId()}`)
      }
      return transmissions
    }
    return throttler
  }
  const fsm = fsmFactory()
  const {
    ioIsolate,
    ioCrypto,
    ioConsistency,
    ioPool,
    ioIncrease,
    ioReceive,
    ioTransmit,
  } = fsm

  const sqsTx = sqsQueueFactory('sqsTx', txModel)
  const sqsRx = sqsQueueFactory('sqsRx', txModel)
  const sqsTransmit = sqsQueueFactory('sqsTransmit', interblockModel)
  const sqsPool = sqsQueueFactory('sqsPool', interblockModel)
  const sqsIncrease = sqsQueueFactory('sqsIncrease', addressModel)
  const sqsQueues = { sqsTx, sqsRx, sqsTransmit, sqsPool, sqsIncrease }

  sqsRx.setProcessor(receiver(ioReceive, sqsPool, sqsTransmit))
  sqsTransmit.setProcessor(transmitter(ioTransmit, sqsTx, sqsPool))
  sqsPool.setProcessor(pooler(ioPool, sqsIncrease))
  sqsIncrease.setProcessor(increasor(ioIncrease, sqsTransmit, sqsIncrease))
  return { ...fsm, ...sqsQueues }
}
module.exports = { standardEngineFactory }
