import assert from 'assert-fast'
import { assign } from 'xstate'
import { poolMachine } from '../machines'
import { pure } from '../../../w001-xstate-direct'
import { Block, Lock, Interblock } from '../../../w015-models'
import { initializeConfig } from './initializeConfig'
import { lockProducer } from '../../../w016-producers'
import { toFunctions as consistencyFn } from '../services/consistencyFactory'
import Debug from 'debug'
const debug = Debug('interblock:cfg:pool')

const poolConfig = (ioCrypto, ioConsistency) => {
  const consistency = consistencyFn(ioConsistency)
  const config = {
    actions: {
      assignInterblock: assign({
        interblock: (context, event) => {
          debug(`assignInterblock`)
          const interblock = event.payload
          assert(interblock instanceof Interblock)
          return interblock
        },
      }),
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          assert(event.data instanceof Lock)
          return event.data
        },
      }),
      mergeGenesis: assign({
        nextBlock: ({ interblock }) => {
          debug(`mergeGenesis`)
          assert(interblock instanceof Interblock)
          const nextBlock = interblock.extractGenesis()
          return nextBlock
        },
      }),
      mergeBlockToLock: assign({
        lock: ({ lock, nextBlock }) => {
          assert(lock instanceof Lock)
          assert(nextBlock instanceof Block)
          debug(`mergeBlockToLock`)
          const nextLock = lockProducer.reconcile(lock, nextBlock)
          return nextLock
        },
      }),
      unassignLock: assign({
        lock: () => undefined,
      }),
      assignTargetBlock: assign({
        targetBlock: (context, event) => {
          const { targetBlock } = event.data
          debug(`assignTargetBlock height`, targetBlock.provenance.height)
          assert(!targetBlock || targetBlock instanceof Block)
          return targetBlock
        },
      }),
      assignIsPooled: assign({
        isPooled: () => {
          debug('isPooled', true)
          return true
        },
      }),
    },
    guards: {
      isInitialConditions: (context, event) => {
        const { isInitialConditions } = event.data
        assert.strictEqual(typeof isInitialConditions, 'boolean')
        debug(`isInitialConditions`, isInitialConditions)
        return isInitialConditions
      },
      isGenesis: ({ interblock }) => {
        assert(interblock instanceof Interblock)
        const isGenesis = interblock.isGenesisAttempt()
        debug(`isGenesis: ${isGenesis}`)
        return isGenesis
      },
      isOriginPresent: (context, event) => {
        const isOriginPresent = event.data
        assert(typeof isOriginPresent === 'boolean')
        debug(`isOriginPresent: ${isOriginPresent}`)
        return isOriginPresent
      },
      isLockFailed: (context, event) => {
        const isLockFailed = !event.data && !(event.data instanceof Lock)
        debug(`isLockFailed: ${isLockFailed}`)
        return isLockFailed
      },
      isBirthingCompleted: ({ lock }) => {
        assert(lock instanceof Lock)
        const isBirthingCompleted = !!lock.block
        debug(`isBirthingCompleted: ${isBirthingCompleted}`)
        return isBirthingCompleted
      },
      isTargetBlockMissing: ({ targetBlock }) => !targetBlock,
      isAddable: ({ targetBlock, interblock }) => {
        assert(targetBlock instanceof Block)
        assert(interblock instanceof Interblock)
        const isAddable = targetBlock.isInterblockAddable(interblock)
        debug(`isAddable`, isAddable)
        return isAddable
      },
      isConnectable: ({ targetBlock, interblock }) => {
        assert(targetBlock instanceof Block)
        assert(interblock instanceof Interblock)
        const isConnectable =
          interblock.isConnectionAttempt() &&
          targetBlock.config.isPublicChannelOpen
        debug(`isConnectable: `, isConnectable)
        return isConnectable
      },
    },
    services: {
      initializeStorage: async () => {
        const { machine, config } = initializeConfig(ioCrypto, ioConsistency)
        const result = await pure('INITIALIZE', machine, config)
        const { isInitialConditions } = result
        debug(`initializeStorage isInitialConditions: ${isInitialConditions}`)
        return { isInitialConditions }
      },
      // always have to get the target block anyway, to see if this is valid

      checkIsOriginPresent: async ({ interblock }) => {
        // check the origin of the genesis interblock is hosted by us
        const address = interblock.provenance.getAddress()
        // turn this into getLatest
        // also confirm the validator matches, as we might host other blocks
        const isOriginPresent = await consistency.getIsPresent(address)
        debug(`checkIsOriginPresent: %O`, !!isOriginPresent)
        return !!isOriginPresent
      },
      lockChildChain: async ({ interblock }) => {
        assert(interblock instanceof Interblock)
        const address = interblock.extractGenesis().provenance.getAddress()
        // TODO split out to allow lockChain to be reused for init
        const lock = await consistency.putLockChain(address)
        debug(`lockChildChain for ${address.getChainId()}: ${!!lock}`)
        return lock
      },
      unlockChain: async ({ lock }) => {
        assert(lock instanceof Lock)
        assert(lock.block)
        debug(`unlockChain`, lock.block.getChainId().substring(0, 9))
        await consistency.putUnlockChain(lock)
      },
      fetchTargetBlock: async ({ interblock }) => {
        assert(interblock instanceof Interblock)
        const address = interblock.getTargetAddress()
        const targetBlock = await consistency.getBlock({ address })
        debug(`fetchTargetBlock complete`)
        return { targetBlock }
      },
      storeInPool: async ({ interblock }) => {
        assert(interblock instanceof Interblock)
        debug(`storeInPool`)
        await consistency.putPoolInterblock({ interblock })
        debug(`storeInPool completed`)
      },
    },
  }
  return { machine: poolMachine, config }
}

export { poolConfig }
