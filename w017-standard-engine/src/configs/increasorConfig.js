const assert = require('assert')
const debug = require('debug')('interblock:config:increasor')
const _ = require('lodash')
const { assign } = require('xstate')
const {
  channelModel,
  lockModel,
  addressModel,
  dmzModel,
  blockModel,
  interblockModel,
  networkModel,
  rxRequestModel,
  txReplyModel,
} = require('../../../w015-models')
const { blockProducer, lockProducer } = require('../../../w016-producers')
const { generateNext } = blockProducer
const { thread } = require('../execution/thread')
const { machine } = require('../machines/increasor')
const { definition: isolatorDefinition } = require('../machines/isolator')
const consistencyProcessor = require('../services/consistencyFactory')
const cryptoProcessor = require('../services/cryptoFactory')
const isolateProcessor = require('../services/isolateFactory')
const { isolatorConfig } = require('./isolatorConfig')
const { pure } = require('../../../w001-xstate-direct')

const increasorConfig = (ioCrypto, ioConsistency, ioIsolate) => {
  const consistency = consistencyProcessor.toFunctions(ioConsistency)
  const crypto = cryptoProcessor.toFunctions(ioCrypto)
  const isolate = isolateProcessor.toFunctions(ioIsolate)
  return machine.withConfig({
    actions: {
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          const { lock } = event.data
          assert(lockModel.isModel(lock))
          return lock
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
      repeatLock: assign({
        nextLock: ({ lock }) => lock,
      }),
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
        const { lock } = event.data
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
        const { network } = nextDmz
        assert(lock.block, 'increasor never makes a new chain')
        const previousNetwork = lock.block.network
        const txChanged = network.txInterblockAliases(previousNetwork)
        const pierceChanged = _isPierceChanged(network, previousNetwork)
        const isDmzChanged = txChanged.length || pierceChanged
        debug(`isDmzChanged: ${isDmzChanged}`)
        return isDmzChanged
      },
      isNewBlock: ({ block }) => {
        const isNewBlock = block && blockModel.isModel(block)
        debug(`isNewBlock: ${isNewBlock}`)
        return isNewBlock
      },
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
        debug(`lockChain ${address.getChainId()}`)
        assert(addressModel.isModel(address))
        const lock = await consistency.putLockChain(address)
        return { lock }
      },
      isolatedExecution: async ({ lock }) => {
        const execute = {
          type: 'EXECUTE_COVENANT',
          payload: { lock },
        }
        const isolator = isolatorConfig(ioIsolate)
        const config = isolator.options
        const context = isolator.context
        const definition = { ...isolatorDefinition, context }
        const { dmz, containerId } = await pure(execute, definition, config)

        // const { dmz, containerId } = await thread(executeCovenant, isolator)
        assert(dmzModel.isModel(dmz))
        return { dmz, containerId }
      },
      signBlock: async ({ lock, nextDmz }) => {
        assert(dmzModel.isModel(nextDmz))
        assert(lockModel.isModel(lock))
        const { block } = lock
        assert(block)

        const nextBlock = await generateNext(nextDmz, block, crypto.sign)

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
            const payload = await isolate.executeEffect({
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

        await isolate.unloadCovenant(containerId)
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
  })
}

const _isPierceChanged = (network, previous) => {
  if (!network['.@@io']) {
    return false
  }
  const ioChannel = network['.@@io']
  const previousChannel = previous['.@@io'] || channelModel.create()
  return ioChannel.isTxGreaterThan(previousChannel)
}

module.exports = { increasorConfig }
