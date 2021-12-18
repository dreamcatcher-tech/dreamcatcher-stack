import assert from 'assert-fast'
import { sqsQueueFactory } from '../../w003-queue'
import { Interblock, Address, Tx } from '../../w015-models'
import { fsmFactory } from './fsmFactory'
import Debug from 'debug'
const debugBase = Debug('interblock:engine')

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
    assert(tx instanceof Tx)
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
    assert(interblock instanceof Interblock)
    // TODO split into multiple calls, so can push out earlier
    const transmissions = await ioTransmit.push(interblock)
    assert(transmissions.every((v) => v instanceof Tx))
    debug(`tramission lengths:`, transmissions.length)
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
    assert(interblock instanceof Interblock)
    const { isPooled } = await ioPool.push(interblock)
    assert.strictEqual(typeof isPooled, 'boolean', `failed pool`)
    debug(`isPooled: %o`, isPooled)
    if (isPooled) {
      const address = interblock.getTargetAddress()
      await sqsIncrease.push(address)
    }
  }
  // TODO test behaviour independently, concurrent - maybe with dirty queues ?
  const increasor = (ioIncrease, sqsTransmit) => {
    const redrives = new Map()
    const locks = new Map() // TODO delete this now have proper locking ?
    const debugIncreasor = debugBase.extend('increasor')
    const throttler = async (address) => {
      assert(address instanceof Address)
      const chainId = address.getChainId()
      if (!locks.has(chainId)) {
        locks.set(chainId, true)
        const debug = debugIncreasor.extend(chainId.substring(0, 6))

        await runInBand(async () => {
          do {
            redrives.delete(chainId)
            const start = Date.now()
            const result = await ioIncrease.push(address)
            const txStart = Date.now()
            const { txInterblocks, isRedriveRequired } = result
            assert(Array.isArray(txInterblocks))
            assert(txInterblocks.every((v) => v instanceof Interblock))
            assert.strictEqual(typeof isRedriveRequired, 'boolean')
            const awaits = txInterblocks.map((interblock) =>
              sqsTransmit.push(interblock)
            )
            await Promise.all(awaits)
            // TODO speed up by increasing next block before this completes
            // TODO if cannot get the lock, then set redrive ?
            if (isRedriveRequired) {
              redrives.set(chainId, true)
            }
            if (!txInterblocks.length) {
              debug(`WASTED ioIncrease total: %i ms`, Date.now() - start)
            } else {
              const msg = `tx: ${txInterblocks.length}`
              debug(`ioIncrease ${msg} %i ms`, Date.now() - start)
            }
          } while (redrives.get(chainId))
        })
        locks.delete(chainId)
      } else {
        redrives.set(chainId, true)
      }
    }
    return throttler
  }
  let isRunning = false
  const pending = []
  // when engine is optimal, isRunInBand makes no difference to performance
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

  const sqsTx = sqsQueueFactory('sqsTx', Tx)
  const sqsRx = sqsQueueFactory('sqsRx', Tx)
  const sqsTransmit = sqsQueueFactory('sqsTransmit', Interblock)
  const sqsPool = sqsQueueFactory('sqsPool', Interblock)
  const sqsIncrease = sqsQueueFactory('sqsIncrease', Address)
  const sqsQueues = { sqsTx, sqsRx, sqsTransmit, sqsPool, sqsIncrease }

  sqsRx.setProcessor(receiver(ioReceive, sqsPool, sqsTransmit))
  sqsTransmit.setProcessor(transmitter(ioTransmit, sqsTx, sqsPool))
  sqsPool.setProcessor(pooler(ioPool, sqsIncrease))
  sqsIncrease.setProcessor(increasor(ioIncrease, sqsTransmit, sqsIncrease))
  const engine = { ...fsm, ...sqsQueues }
  Object.freeze(engine)
  return engine
}
export { standardEngineFactory }
