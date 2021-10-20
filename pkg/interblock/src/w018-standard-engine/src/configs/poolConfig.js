import assert from 'assert-fast'
import { assign } from 'xstate'
import { poolMachine } from '../machines'
import {
  channelModel,
  networkModel,
  blockModel,
  lockModel,
  interblockModel,
  addressModel,
  dmzModel,
  covenantIdModel,
  publicKeyModel,
} from '../../../w015-models'
import { lockProducer } from '../../../w016-producers'
import { toFunctions as consistencyFn } from '../services/consistencyFactory'
import { toCryptoFunctions as cryptoFn } from '../services/cryptoFactory'
import Debug from 'debug'
const debug = Debug('interblock:cfg:pool')

const poolConfig = (ioCrypto, ioConsistency) => {
  const consistency = consistencyFn(ioConsistency)
  const crypto = cryptoFn(ioCrypto)
  const config = {
    actions: {
      assignInterblock: assign({
        interblock: (context, event) => {
          debug(`assignInterblock`)
          const interblock = event.payload
          assert(interblockModel.isModel(interblock))
          return interblock
        },
      }),
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          assert(lockModel.isModel(event.data))
          return event.data
        },
      }),
      mergeGenesis: assign({
        nextBlock: ({ interblock }) => {
          debug(`mergeGenesis`)
          assert(interblockModel.isModel(interblock))
          const nextBlock = interblock.extractGenesis()
          return nextBlock
        },
      }),
      mergeBlockToLock: assign({
        lock: ({ lock, nextBlock }) => {
          assert(lockModel.isModel(lock))
          assert(blockModel.isModel(nextBlock))
          debug(`mergeBlockToLock increased: ${!nextBlock.equals(lock.block)}`)
          const nextLock = lockProducer.reconcile(lock, nextBlock)
          return nextLock
        },
      }),
      assignGeneratedBlock: assign({
        nextBlock: (context, event) => {
          assert(blockModel.isModel(event.data))
          debug(`assignGeneratedBlock`)
          return event.data
        },
      }),
      unassignLock: assign({
        lock: () => undefined,
      }),
      createBaseDmz: assign({
        baseDmz: ({ validators }) => {
          debug(`createBaseDmz`)
          const covenantId = covenantIdModel.create('hyper')
          const root = addressModel.create('ROOT')
          const sealedRoot = channelModel.create(root)
          const sealedParent = {
            ...networkModel.create(),
            '..': sealedRoot,
          }
          const dmz = dmzModel.create({
            covenantId,
            validators,
            network: sealedParent,
            // TODO tighten permissions
            config: { isPierced: true, isPublicChannelOpen: true },
          })
          return dmz
        },
      }),
      assignValidatorKey: assign({
        validators: (context, event) => {
          debug(`assignValidatorKey: %o`, event.data)
          const result = Object.values(event.data)[0]
          assert(publicKeyModel.isModel(result))
          return event.data
        },
      }),
      assignTargetBlock: assign({
        targetBlock: (context, event) => {
          const { targetBlock } = event.data
          debug(`assignTargetBlock`, targetBlock.provenance.height)
          assert(!targetBlock || blockModel.isModel(targetBlock))
          return targetBlock
        },
      }),
    },
    guards: {
      isStorageEmpty: (context, event) => {
        const { isStorageEmpty } = event.data
        debug(`isStorageEmpty: ${isStorageEmpty}`)
        return isStorageEmpty
      },
      isInitialConditions: ({ baseDmz }) => {
        return !!baseDmz
      },
      isGenesis: ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
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
        const isLockFailed = !event.data && !lockModel.isModel(event.data)
        debug(`isLockFailed: ${isLockFailed}`)
        return isLockFailed
      },
      isBirthingCompleted: ({ lock }) => {
        assert(lockModel.isModel(lock))
        const isBirthingCompleted = !!lock.block
        debug(`isBirthingCompleted: ${isBirthingCompleted}`)
        return isBirthingCompleted
      },
      isTargetBlockMissing: ({ targetBlock }) => !targetBlock,
      isAddable: ({ targetBlock, interblock }) => {
        assert(blockModel.isModel(targetBlock))
        assert(interblockModel.isModel(interblock))
        return targetBlock.isInterblockAddable(interblock)
      },
      isConnectable: ({ targetBlock, interblock }) => {
        assert(blockModel.isModel(targetBlock))
        assert(interblockModel.isModel(interblock))
        const isConnectable =
          interblock.isConnectionAttempt() &&
          targetBlock.config.isPublicChannelOpen
        debug(`isConnectable: `, isConnectable)
        return isConnectable
      },
    },
    services: {
      // always have to get the target block anyway, to see if this is valid
      isStorageEmpty: async () => {
        const blankAddress = undefined
        const firstBlock = await consistency.getBlock({
          address: blankAddress,
        })
        const isStorageEmpty = !firstBlock
        debug(`isStorageEmpty: ${isStorageEmpty}`)
        return { isStorageEmpty }
      },
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
        assert(interblockModel.isModel(interblock))
        const address = interblock.extractGenesis().provenance.getAddress()
        // TODO split out to allow lockChain to be reused for init
        const lock = await consistency.putLockChain(address)
        debug(`lockChildChain for ${interblock.getOriginAlias()}: ${!!lock}`)
        return lock
      },
      unlockChain: async ({ lock }) => {
        assert(lockModel.isModel(lock))
        debug(`unlockChain`)
        await consistency.putUnlockChain(lock)
        return
      },
      fetchValidatorKey: async () => {
        debug(`fetchValidatorKey`)
        const entry = await crypto.getValidatorEntry()
        return entry
      },
      signBlock: async ({ baseDmz }) => {
        // TODO replace with dedicated startup process
        debug(`signBlock`)
        assert(dmzModel.isModel(baseDmz))
        const block = blockModel.create(baseDmz)
        return block
      },
      lockBaseChain: async ({ nextBlock }) => {
        debug(`lockBaseChain`)
        const address = nextBlock.provenance.getAddress()
        const lock = await consistency.putLockChain(address)
        return lock
      },
      fetchTargetBlock: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const address = interblock.getTargetAddress()
        const targetBlock = await consistency.getBlock({ address })
        debug(`fetchTargetBlock complete`)
        return { targetBlock }
      },
      storeInPool: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        debug(`storeInPool`)
        await consistency.putPoolInterblock({ interblock })
        debug(`storeInPools completed`)
      },
    },
  }
  return { machine: poolMachine, config }
}

export { poolConfig }
