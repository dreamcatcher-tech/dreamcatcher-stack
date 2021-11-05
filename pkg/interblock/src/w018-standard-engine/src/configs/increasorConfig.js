import assert from 'assert-fast'
import { assign } from 'xstate'
import {
  channelModel,
  lockModel,
  addressModel,
  dmzModel,
  blockModel,
  interblockModel,
  rxRequestModel,
  txReplyModel,
  turnoverModel,
} from '../../../w015-models'
import { blockProducer, lockProducer } from '../../../w016-producers'
import { increasorMachine } from '../machines'
import { toFunctions as consistencyFn } from '../services/consistencyFactory'
import { toCryptoFunctions } from '../services/cryptoFactory'
import { toFunctions as isolateFn } from '../services/isolateFactory'
import { isolatorConfig } from './isolatorConfig'
import { pure } from '../../../w001-xstate-direct'
import Debug from 'debug'
const debug = Debug('interblock:cfg:increasor')

const increasorConfig = (ioCrypto, ioConsistency, ioIsolate) => {
  const consistency = consistencyFn(ioConsistency)
  const crypto = toCryptoFunctions(ioCrypto)
  const isolation = isolateFn(ioIsolate)
  const isolatorMachine = isolatorConfig(isolation, consistency)

  const config = {
    actions: {
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          const { lock } = event.data
          assert(lockModel.isModel(lock))
          return lock
        },
      }),
      reviveCache: assign({
        cachedDmz: ({ cache, lock }) => {
          assert(lockModel.isModel(lock))
          assert(lock.block)
          const chainId = lock.block.getChainId()
          assert(cache.has(chainId))
          const { nextDmz } = cache.get(chainId)
          debug(`reviveCache.nextDmz`)
          return nextDmz
        },
        lock: ({ cache, lock }) => {
          const chainId = lock.block.getChainId()
          assert(cache.has(chainId))
          const { lock: previousLock, nextDmz } = cache.get(chainId)
          assert(lock.block.equals(previousLock.block))
          // purge the current lock against the old one and the old dmz
          const interblocks = _purgeInterblocks(lock, nextDmz)
          const piercings = _purgePiercings(lock, previousLock)
          debug(`reviveCache.lock`)
          return lockModel.clone({ ...lock, interblocks, piercings })
        },
      }),
      assignNextDmz: assign({
        nextDmz: (context, event) => {
          const { dmz } = event.data
          assert(dmzModel.isModel(dmz))
          debug(`assignNextDmz`)
          return dmz
        },
      }),
      assignContainerId: assign({
        containerId: (context, event) => {
          const { containerId } = event.data
          assert(!containerId || typeof containerId === 'string')
          debug(`assignContainerId: `, containerId)
          return containerId
        },
      }),
      assignBlock: assign({
        block: (context, event) => {
          const { nextBlock } = event.data
          assert(blockModel.isModel(nextBlock))
          const short = nextBlock.getChainId().substring(0, 9)
          debug(`assignBlock`, short, nextBlock.provenance.height)
          return nextBlock
        },
      }),
      reconcileLock: assign({
        nextLock: ({ lock, block }) => {
          // TODO remove reconciliation completely
          assert(lockModel.isModel(lock))
          assert(blockModel.isModel(block))
          debug(`reconcileLock`)
          const nextLock = lockProducer.reconcile(lock, block)
          return nextLock
        },
      }),
      clearCache: ({ lock, cache }) => {
        // wipe out the cache as a block has just been made
        assert(lockModel.isModel(lock))
        assert(lock.block)
        const chainId = lock.block.getChainId()
        cache.delete(chainId)
        debug(`clearCache: `, chainId.substring(0, 9))
      },
      repeatLock: assign({
        nextLock: ({ lock }) => lock,
      }),
      cachePartial: ({ cache, lock, nextDmz }) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        assert(dmzModel.isModel(nextDmz))
        const chainId = lock.block.getChainId()
        cache.set(chainId, { lock, nextDmz })
        debug(`cachePartial: `, chainId.substring(0, 9))
      },
      assignIsRedriveRequired: assign({
        isRedriveRequired: ({ isRedriveRequired: current }, event) => {
          assert(!current)
          const { effectsReplyCount } = event.data
          assert(Number.isInteger(effectsReplyCount))
          assert(effectsReplyCount >= 0)
          const isRedriveRequired = !!effectsReplyCount
          debug(`isRedriveRequired`, isRedriveRequired)
          return isRedriveRequired
        },
      }),
      calculateTurnoverHeights: assign({
        turnoverHeights: ({ block }) => {
          assert(blockModel.isModel(block))
          assert(!block.provenance.address.isGenesis())
          const txAliases = block.network.txInterblockAliases()
          debug(`calculateTurnoverHeights tx length:`, txAliases.length)
          const heights = new Set()
          for (const alias of txAliases) {
            const channel = block.network[alias]
            if (channel.precedent.isUnknown()) {
              // TODO handle multiple turnover events in the chain
              heights.add(0)
            }
          }
          const turnoverHeights = [...heights]
          debug(`calculateTurnoverHeights count:`, turnoverHeights.length)

          assert.strictEqual(turnoverHeights.length, heights.size)
          return turnoverHeights
        },
      }),
      assignTurnoverBlocks: assign({
        turnoverBlocks: (context, event) => {
          const { turnoverBlocks } = event.data
          assert(Array.isArray(turnoverBlocks))
          assert(turnoverBlocks.every(blockModel.isModel))
          debug(`assignTurnoverBlocks:`, turnoverBlocks.length)
          const map = {}
          for (const block of turnoverBlocks) {
            map[block.provenance.height] = block
          }
          return map
        },
      }),
      assignTxInterblocks: assign({
        txInterblocks: ({ block, turnoverBlocks }) => {
          assert(blockModel.isModel(block))
          assert(!block.provenance.address.isGenesis())
          assert(Object.values(turnoverBlocks).every(blockModel.isModel))
          const txAliases = block.network.txInterblockAliases()
          debug(`assignTxInterblocks length:`, txAliases.length)
          const interblocks = txAliases.map((alias) => {
            const channel = block.network[alias]
            const turnovers = []
            if (channel.precedent.isUnknown()) {
              const turoverBlock = turnoverBlocks[0]
              const turnover = turnoverModel.create(turoverBlock)
              turnovers.push(turnover)
            }
            return interblockModel.create(block, alias, turnovers)
          })
          return interblocks
        },
      }),
    },
    guards: {
      isLockAcquired: (context, event) => {
        let isLockAcquired = false
        const { lock } = event.data
        if (lock) {
          assert(lockModel.isModel(lock))
          assert(lock.block, `Chain has no blocks`)
          isLockAcquired = !!lock.block
        }
        debug(`isLockAcquired: `, isLockAcquired)
        return isLockAcquired
      },
      isProposer: () => true,
      isValidator: () => false,
      isIncreasable: ({ lock }) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        // TODO check if dmz config allows piercing too
        const isPiercings = lock.isPiercingsPresent()
        const isInterblocks = lock.interblocks.length
        if (!isPiercings && !isInterblocks) {
          debug(`isIncreasable: `, false)
          return false
        }
        debug(`isIncreasable isInterblocks: %o`, isInterblocks)
        debug(`isIncreasable isPiercings: %o`, isPiercings)
        return true
      },
      isCacheEmpty: ({ cache, lock }) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        const isCacheEmpty = !cache.has(lock.block.getChainId())
        debug(`isCacheEmpty: `, isCacheEmpty)
        return isCacheEmpty
      },
      isIsolationComplete: ({ nextDmz }) => {
        const isIsolationComplete = !!nextDmz
        debug(`isIsolationComplete: ${isIsolationComplete}`)
        return isIsolationComplete
      },
      isDmzTransmitting: ({ lock, nextDmz }) => {
        // outgoing changes detected
        assert(lockModel.isModel(lock))
        assert(lock.block, 'increasor never makes a new chain')
        assert(dmzModel.isModel(nextDmz))
        const isDmzTransmitting = nextDmz.isTransmitting()
        debug(`isDmzTransmitting: ${isDmzTransmitting}`)
        return isDmzTransmitting
      },
      isNewBlock: ({ block }) => {
        const isNewBlock = blockModel.isModel(block)
        debug(`isNewBlock: ${isNewBlock}`)
        return isNewBlock
      },
      isNoNextDmz: ({ nextDmz }) => !nextDmz,
      isEffectable: ({ block, containerId }) => {
        assert(blockModel.isModel(block))
        assert.strictEqual(typeof containerId, 'string')
        const isEffectable = !!(block.config.isPierced && containerId)
        // TODO check for new effect actions in io channel
        debug(`isEffectable %o`, isEffectable)
        return isEffectable
      },
    },
    services: {
      lockChain: async (context, event) => {
        const address = event.payload
        debug(`lockChain ${address.getChainId().substring(0, 9)}`)
        assert(addressModel.isModel(address))
        const lock = await consistency.putLockChain(address)
        return { lock }
      },
      isolatedExecution: async ({ lock }) => {
        const execute = {
          type: 'EXECUTE_COVENANT',
          payload: { lock },
        }
        const { machine, config } = isolatorMachine
        const isolatedExecution = () => pure(execute, machine, config)
        const { dmz, containerId } = await isolatedExecution()

        assert(dmzModel.isModel(dmz))
        return { dmz, containerId }
      },
      signBlock: async ({ lock, nextDmz }) => {
        assert(lockModel.isModel(lock))
        const { block } = lock
        assert(block)
        assert(dmzModel.isModel(nextDmz))
        debug(`signBlock`)

        const unsignedBlock = blockProducer.generateUnsigned(nextDmz, block)
        const signature = await crypto.sign(unsignedBlock.provenance.integrity)
        const nextBlock = blockProducer.assemble(unsignedBlock, signature)
        return { nextBlock }
      },
      effects: async ({ containerId, nextLock, lock }) => {
        // TODO move effects to be in transmit machine
        assert.strictEqual(typeof containerId, 'string')
        assert(nextLock.block)
        assert(!nextLock.block.equals(lock.block))
        debug(`effects`)
        const io = nextLock.block.network['.@@io']
        assert(io && nextLock.block.config.isPierced)
        // TODO set container permissions to allow network access
        const timeout = 30000
        const awaits = io.requests.map(async (request, index) => {
          const effectId = request.payload['@@effectId']
          assert(Number.isInteger(effectId))
          assert(effectId >= 0)
          const { type, payload } = request
          const address = nextLock.block.provenance.getAddress()
          const height = nextLock.block.provenance.height
          const rxRequest = rxRequestModel.create(
            type,
            payload,
            address,
            height,
            index
          )
          const { identifier } = rxRequest
          let txReply
          try {
            const payload = await isolation.executeEffect({
              containerId,
              effectId,
              timeout,
            })
            debug(`effects payload: `, payload)
            txReply = txReplyModel.create('@@RESOLVE', payload, identifier)
          } catch (payload) {
            txReply = txReplyModel.create('@@REJECT', payload, identifier)
          }
          await consistency.putPierceReply({ txReply })
          debug(`reply address:`, txReply.getAddress().getChainId())
          return txReply
        })
        // TODO race against a timeout, then take only what was completed
        const settlements = await Promise.all(awaits)
        debug(`settlements: `, settlements)

        await isolation.unloadCovenant(containerId)
        return { effectsReplyCount: settlements.length }
      },
      fetchTurnoverBlocks: async ({ block, turnoverHeights }) => {
        assert(blockModel.isModel(block))
        assert(Array.isArray(turnoverHeights))
        assert(turnoverHeights.every(Number.isInteger))
        const heights = turnoverHeights
        const address = block.provenance.getAddress()
        const turnoverBlocks = await consistency.getBlocks({ address, heights })
        return { turnoverBlocks }
      },
      unlockChain: async ({ nextLock }) => {
        assert(lockModel.isModel(nextLock))
        debug(`unlockChain`)
        // TODO handle unlock rejection
        await consistency.putUnlockChain(nextLock)
        return
      },
    },
  }
  return { machine: increasorMachine, config }
}
const _purgePiercings = (lock, previousLock) => {
  // leverage that piercings are always fully processed each cycle
  const { requests: origReqs, replies: origReps } = lock.piercings
  const { requests: prevReqs, replies: prevReps } = previousLock.piercings
  const requests = origReqs.filter(
    (txRequest) => !prevReqs.some((pr) => pr.equals(txRequest))
  )
  const replies = origReps.filter(
    (txReply) => !prevReps.some((pr) => pr.equals(txReply))
  )
  return { requests, replies }
}
const _purgeInterblocks = (lock, cachedDmz) => {
  // must compare with dmz, as lineage hole might be present
  const { interblocks } = lock
  return interblocks.filter((ib) => !cachedDmz.network.includesInterblock(ib))
}
const _isPierceChanged = (network, previous) => {
  if (!network['.@@io']) {
    return false
  }
  const ioChannel = network['.@@io']
  const previousChannel = previous['.@@io'] || channelModel.create()
  return ioChannel.isTxGreaterThan(previousChannel)
}

export { increasorConfig }
