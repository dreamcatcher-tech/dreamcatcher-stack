const assert = require('assert')
const _ = require('lodash')
const pad = require('pad/dist/pad.cjs')
const { sqsQueueFactory } = require('../../w003-queue')
const {
  interblockModel,
  addressModel,
  txModel,
  socketModel,
} = require('../../w015-models')
const { fsmFactory } = require('./fsmFactory')
const debugBase = require('debug')('interblock:engine')

/**
 * Takes the finite state machines and connects them up using queues.
 * The queues are processed by the pooler and increasor processors defined here.
 * The sqs queues are created here, which are tapped by aws.
 * sqs queues threadbreak, in that they cannot be awaited on for a result.
 */
const standardEngineFactory = () => {
  debugBase(`standardEngineFactory`)

  const receiver = (ioReceive, sqsPool, sqsTransmit) => async (tx) => {
    const debug = debugBase.extend('receiver')
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
    const debug = debugBase.extend('transmitter')
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
    const debug = debugBase.extend('pooler')
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
  const increasor = (ioIncrease, sqsTransmit) => {
    const redrives = new Map()
    const locks = new Map()
    const throttler = async (address) => {
      assert(addressModel.isModel(address))
      await runInBand(async () => {
        const chainId = address.getChainId()
        const debug = debugBase
          .extend('increasor')
          .extend(chainId.substring(0, 6))

        if (!locks.get(chainId)) {
          do {
            redrives.delete(chainId)
            locks.set(chainId, true)
            debug(`start`)
            const start = Date.now()
            const result = await ioIncrease.push(address)
            const txStart = Date.now()
            debug(`ioIncrease complete: %i ms`, txStart - start)
            const { txInterblocks, isRedriveRequired } = result
            assert(Array.isArray(txInterblocks))
            assert(txInterblocks.every(interblockModel.isModel))
            assert.strictEqual(typeof isRedriveRequired, 'boolean')
            debug(`transmission count: ${txInterblocks.length}`)
            const awaits = txInterblocks.map((interblock) =>
              sqsTransmit.push(interblock)
            )
            await Promise.all(awaits)
            // TODO speed up by increasing next block before this completes
            locks.delete(chainId)
            // TODO if cannot get the lock, then set redrive ?
            if (isRedriveRequired) {
              redrives.set(chainId, true)
            }
            debug(`txInterblocks complete: %i ms`, Date.now() - txStart)
            debug(`ioIncrease total: %i ms`, Date.now() - start)
          } while (redrives.get(chainId))
        } else {
          redrives.set(chainId, true)
        }
      })
    }
    return throttler
  }
  let isRunning = false
  const pending = []
  const isRunInBand = false
  const runInBand = async (fn) => {
    if (!isRunInBand) {
      return fn()
    }
    pending.push(fn)
    if (isRunning) {
      return
    }
    while (pending.length) {
      isRunning = true
      const nextFn = pending.shift()
      const result = await nextFn()
      isRunning = false
    }
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
  const engine = { ...fsm, ...sqsQueues }
  Object.freeze(engine)
  return engine
}
module.exports = { standardEngineFactory }
