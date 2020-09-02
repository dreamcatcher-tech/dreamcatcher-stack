const assert = require('assert')
const debug = require('debug')('interblock:config:increasor')
const _ = require('lodash')
const { assign } = require('xstate')
const {
  lockModel,
  addressModel,
  dmzModel,
  blockModel,
  interblockModel,
  networkModel,
} = require('../../../w015-models')
const {
  blockProducer,
  lockProducer,
  networkProducer,
} = require('../../../w016-producers')
const { generateNext } = blockProducer
const { thread } = require('../execution/thread')
const { machine } = require('../machines/increasor')
const consistencyProcessor = require('../services/consistencyFactory')
const cryptoProcessor = require('../services/cryptoFactory')
const { isolatorConfig } = require('./isolatorConfig')

const increasorConfig = (ioCrypto, ioConsistency, ioIsolate) => {
  const consistency = consistencyProcessor.toFunctions(ioConsistency)
  const crypto = cryptoProcessor.toFunctions(ioCrypto)
  return machine.withConfig({
    actions: {
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          const lock = event.data
          assert(lockModel.isModel(lock))
          return lock
        },
      }),
      assignNextDmz: assign({
        nextDmz: (context, event) => {
          const nextDmz = event.data
          assert(dmzModel.isModel(nextDmz))
          return nextDmz
        },
      }),
      assignBlock: assign({
        block: (context, event) => {
          const block = event.data
          assert(blockModel.isModel(block))
          return block
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
      repeatLock: assign({
        nextLock: ({ lock }) => lock,
      }),
      assignTxInterblocks: assign({
        txInterblocks: ({ block, lock }) => {
          debug(`txInterblocks`) // TODO move to state machine internals
          const previous = lock.block
          assert(blockModel.isModel(block))
          assert(blockModel.isModel(previous))
          assert(!block.provenance.address.isGenesis())
          let previousNetwork = previous.network
          const isFirstOperatingBlock =
            block.provenance.height === 2 &&
            !block.network['..'].address.isRoot()
          if (isFirstOperatingBlock) {
            // move to actual state machine decision
            // TODO try make increasor do block creation too ?
            previousNetwork = networkModel.create()
          }
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
        const lock = event.data
        if (lock) {
          assert(lockModel.isModel(lock))
          isLockAcquired = lock.block
          !lock.block && debug(`WARNING missing chain locked`)
        }
        debug(`isLockAcquired: `, !!isLockAcquired)
        return isLockAcquired
      },
      isProposer: () => true,
      isValidator: () => false,
      isIsolationComplete: ({ nextDmz }) => {
        const isIsolationComplete = !!nextDmz
        debug(`isIsolationComplete: ${isIsolationComplete}`)
        return isIsolationComplete
      },
      isDmzChanged: ({ lock, nextDmz }) => {
        // outgoing changes detected
        assert(lockModel.isModel(lock))
        assert(dmzModel.isModel(nextDmz))
        assert(lock.block) // increasor never makes a new chain
        const previousNetwork = lock.block.network
        const txs = nextDmz.network.txInterblockAliases(previousNetwork)
        const isDmzChanged = txs.length
        debug(`isDmzChanged: ${isDmzChanged}`)
        return isDmzChanged
      },
      isNewBlock: ({ block }) => {
        const isNewBlock = block && blockModel.isModel(block)
        debug(`isNewBlock: ${isNewBlock}`)
        return isNewBlock
      },
    },
    services: {
      lockChain: async (context, event) => {
        const address = event.payload
        debug(`lockChain ${address.getChainId()}`)
        assert(addressModel.isModel(address))
        const lock = await consistency.putLockChain(address)
        return lock
      },
      isolate: async ({ lock }) => {
        const executeCovenant = {
          type: 'EXECUTE_COVENANT',
          payload: lock,
        }
        const isolator = isolatorConfig(ioIsolate)
        const dmz = await thread(executeCovenant, isolator)
        assert(dmzModel.isModel(dmz))
        return dmz
      },
      signBlock: async ({ lock, nextDmz }) => {
        // TODO only sign the block if it is different to previous ?
        assert(dmzModel.isModel(nextDmz))
        const { block } = lock
        // TODO when a new channel opens, make a new provenance that shortcuts proof needed
        const nextBlock = await generateNext(nextDmz, block, crypto.sign)
        return nextBlock
      },
      unlockChain: async ({ nextLock }) => {
        assert(lockModel.isModel(nextLock))
        debug(`unlockChain`)
        // TODO handle unlock rejection
        const result = await consistency.putUnlockChain(nextLock)
        return result
      },
    },
  })
}

module.exports = { increasorConfig }
