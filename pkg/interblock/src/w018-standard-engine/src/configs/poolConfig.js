import assert from 'assert-fast'
import { assign } from 'xstate'
import { poolMachine } from '../machines'
import {
  Channel,
  Network,
  Block,
  Lock,
  Interblock,
  Address,
  Dmz,
  covenantIdModel,
  PublicKey,
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
          assert(interblock instanceof Interblock)
          return interblock
        },
      }),
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          assert(Lock.isModel(event.data))
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
          debug(`mergeBlockToLock increased: ${!nextBlock.equals(lock.block)}`)
          const nextLock = lockProducer.reconcile(lock, nextBlock)
          return nextLock
        },
      }),
      assignGeneratedBlock: assign({
        nextBlock: (context, event) => {
          assert(event.data instanceof Block)
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
          const root = Address.create('ROOT')
          const sealedRoot = Channel.create(root)
          const sealedParent = Network.create().update({ '..': sealedRoot })
          const dmz = Dmz.create({
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
          assert(result instanceof PublicKey)
          return event.data
        },
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
      isStorageEmpty: (context, event) => {
        const { isStorageEmpty } = event.data
        debug(`isStorageEmpty: ${isStorageEmpty}`)
        return isStorageEmpty
      },
      isInitialConditions: ({ baseDmz }) => {
        const isInitialConditions = !!baseDmz
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
      // always have to get the target block anyway, to see if this is valid
      isStorageEmpty: async () => {
        const baseAddress = await consistency.getBaseAddress()
        const isStorageEmpty = !baseAddress
        debug(`isStorageEmpty service: ${isStorageEmpty}`)
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
        assert(interblock instanceof Interblock)
        const address = interblock.extractGenesis().provenance.getAddress()
        // TODO split out to allow lockChain to be reused for init
        const lock = await consistency.putLockChain(address)
        debug(`lockChildChain for ${interblock.getOriginAlias()}: ${!!lock}`)
        return lock
      },
      unlockChain: async ({ lock }) => {
        assert(lock instanceof Lock)
        debug(`unlockChain`, lock.block.getChainId().substring(0, 9))
        await consistency.putUnlockChain(lock)
      },
      fetchValidatorKey: async () => {
        debug(`fetchValidatorKey`)
        const entry = await crypto.getValidatorEntry()
        return entry
      },
      signBlock: async ({ baseDmz }) => {
        // TODO replace with dedicated startup process
        debug(`signBlock`)
        assert(baseDmz instanceof Dmz)
        const block = Block.create(baseDmz)
        return block
      },
      lockBaseChain: async ({ nextBlock }) => {
        debug(`lockBaseChain`)
        const address = nextBlock.provenance.getAddress()
        const lock = await consistency.putLockChain(address)
        return lock
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
