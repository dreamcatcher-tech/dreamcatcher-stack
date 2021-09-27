import { assert } from 'chai/index.mjs'
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
      assignTxInterblocks: assign({
        txInterblocks: ({ block, lock }) => {
          debug(`txInterblocks`)
          const previous = lock.block
          assert(blockModel.isModel(block))
          assert(blockModel.isModel(previous))
          assert(!block.provenance.address.isGenesis())
          const previousNetwork = previous.network
          const txAliases = block.network.txInterblockAliases(previousNetwork)
          const interblocks = txAliases.map((alias) =>
            interblockModel.create(block, alias)
          )
          debug(`txInterblocks raw length: ${interblocks.length}`)
          // always send a lineage block
          interblocks.push(interblockModel.create(block))
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
          assert(lock.block, `Missing chain locked`)
          isLockAcquired = !!lock.block
        }
        debug(`isLockAcquired: `, isLockAcquired)
        return isLockAcquired
      },
      isProposer: () => true,
      isValidator: () => false,
      isIncreasable: ({ cache, lock }) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        // TODO check if dmz config allows piercing too
        // TODO be precise about whether a heavy in the pool can be enabled by lineage
        const isHeavyPresent = lock.interblocks.some(
          (i) => !!i.getOriginAlias()
        )
        const { requests, replies } = lock.piercings
        const isPiercingsPresent = requests.length || replies.length
        if (!isPiercingsPresent && !isHeavyPresent) {
          debug(`isIncreasable: `, false)
          return false
        }
        const chainId = lock.block.getChainId()
        if (!cache.has(chainId)) {
          debug(`isIncreasable: `, true)
          return true
        }
        // TODO check that the previous lock isn't modified in any way
        const { lock: previousLock, nextDmz } = cache.get(chainId)
        assert(lockModel.isModel(previousLock))
        assert(previousLock.block)
        assert(dmzModel.isModel(nextDmz))
        const purgedPiercings = _purgePiercings(lock, previousLock)
        const isPurgedRequestsPresent = purgedPiercings.requests.length
        const isPurgedRepliesPresent = purgedPiercings.replies.length
        if (isPurgedRequestsPresent || isPurgedRepliesPresent) {
          debug(`isIncreasable: `, true)
          return true
        }

        const purgedIbs = _purgeInterblocks(lock, nextDmz)
        const isPurgedHeavyPresent = purgedIbs.some((i) => !!i.getOriginAlias())
        if (isPurgedHeavyPresent) {
          debug(`isIncreasable: `, true)
          return true
        }
        debug(`isIncreasable: `, false)
        return false
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
        assert(dmzModel.isModel(nextDmz))
        const { network } = nextDmz
        assert(lock.block, 'increasor never makes a new chain')
        const previousNetwork = lock.block.network
        const txChanged = network.txInterblockAliases(previousNetwork)
        const pierceChanged = _isPierceChanged(network, previousNetwork)
        const isDmzTransmitting = txChanged.length || pierceChanged
        debug(`isDmzTransmitting: ${isDmzTransmitting}`)
        return isDmzTransmitting
      },
      isNewBlock: ({ block }) => {
        const isNewBlock = !!block && blockModel.isModel(block)
        debug(`isNewBlock: ${isNewBlock}`)
        return isNewBlock
      },
      isNoNextDmz: ({ nextDmz }) => !nextDmz,
      isEffectable: ({ block, containerId }) => {
        assert(blockModel.isModel(block))
        assert.strictEqual(typeof containerId, 'string')
        const isEffectable = block.config.isPierced && containerId
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
      isolatedExecution: async ({ lock, cachedDmz }) => {
        const execute = {
          type: 'EXECUTE_COVENANT',
          payload: { lock, cachedDmz },
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
        // pull out the new IO channel requests
        let prevIo = channelModel.create()
        if (lock.block && lock.block.network['.@@io']) {
          prevIo = lock.block.network['.@@io']
        }
        const nextIo = nextLock.block.network['.@@io'] || prevIo
        const nextIoIndices = nextIo
          .getRequestIndices()
          .filter((index) => !prevIo.requests[index])
        debug(`nextIoIndices: `, nextIoIndices)
        // TODO set container permissions to allow network access
        const timeout = 30000
        const awaits = nextIoIndices.map(async (index) => {
          const action = nextIo.requests[index]
          assert(action && action.payload)
          // TODO translate to be the indices of the .@@io channel directly
          const effectId = action.payload['.@@ioRequestId']
          assert.strictEqual(typeof effectId, 'string')
          const { type, payload } = action
          const address = nextLock.block.provenance.getAddress()
          const request = rxRequestModel.create(type, payload, address, index)
          const { sequence } = request
          let txReply
          try {
            const payload = await isolation.executeEffect({
              containerId,
              effectId,
              timeout,
            })
            debug(`effects payload: `, payload)
            txReply = txReplyModel.create('@@RESOLVE', payload, sequence)
          } catch (payload) {
            txReply = txReplyModel.create('@@REJECT', payload, sequence)
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
