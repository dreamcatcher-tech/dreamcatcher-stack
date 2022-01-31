import assert from 'assert-fast'
import { assign } from 'xstate'
import machine from '../machines/initialize'
import { toFunctions as consistencyFn } from '../services/consistencyFactory'
import { toCryptoFunctions as cryptoFn } from '../services/cryptoFactory'
import Debug from 'debug'
import {
  Block,
  Channel,
  CovenantId,
  Dmz,
  Lock,
  Network,
  PublicKey,
} from '../../../w015-models'
import { lockProducer } from '../../../w016-producers'
const debug = Debug('interblock:cfg:intialize')

// TODO replace with dedicated startup process instead of
// interblock ignition
const initializeConfig = (ioCrypto, ioConsistency) => {
  const consistency = consistencyFn(ioConsistency)
  const crypto = cryptoFn(ioCrypto)
  const config = {
    actions: {
      assignSystemInitUuid: assign({
        systemInitUuid: (context, event) => {
          const { uuid } = event.data
          assert.strictEqual(typeof uuid, 'string')
          return uuid
        },
      }),
      assignValidatorKey: assign({
        validators: (context, event) => {
          const result = Object.values(event.data)[0]
          assert(result instanceof PublicKey)
          debug(`assignValidatorKey: %o`, Object.keys(event.data)[0])
          return event.data
        },
      }),
      createBaseDmz: assign({
        baseDmz: ({ validators }) => {
          debug(`createBaseDmz`)
          const covenantId = CovenantId.create('hyper')
          const sealedRoot = Channel.createRoot()
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
      assignBaseBlock: assign({
        nextBlock: ({ baseDmz }, event) => {
          assert(baseDmz instanceof Dmz)
          debug(`assignBaseBlock start`)
          const block = Block.create(baseDmz)
          debug(`assignBaseBlock complete`)
          return block
        },
      }),
      assignLock: assign({
        lock: (context, event) => {
          debug(`assignLock`)
          assert(event.data instanceof Lock)
          return event.data
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
    },
    guards: {
      isStorageEmpty: (context, event) => {
        const { isStorageEmpty } = event.data
        debug(`isStorageEmpty: ${isStorageEmpty}`)
        return isStorageEmpty
      },
      isSystemInitLocked: (context, event) => {
        const { uuid } = event.data
        const isSystemInitLocked = typeof uuid === 'string'
        debug(`isSystemInitLocked: ${isSystemInitLocked}`)
        return isSystemInitLocked
      },
    },
    services: {
      isStorageEmpty: async () => {
        const baseAddress = await consistency.getBaseAddress()
        const isStorageEmpty = !baseAddress
        debug(`isStorageEmpty service: ${isStorageEmpty}`)
        return { isStorageEmpty }
      },
      lockSystemInit: async () => {
        debug(`lockSystemInit`)
        const { uuid } = await consistency.putLockSystemInit()
        debug(`lockSystemInit isSystemInitLocked`, uuid)
        return { uuid }
      },
      fetchValidatorKey: async () => {
        debug(`fetchValidatorKey`)
        const entry = await crypto.getValidatorEntry()
        return entry
      },
      lockBaseChain: async ({ nextBlock }) => {
        debug(`lockBaseChain`)
        const address = nextBlock.provenance.getAddress()
        const lock = await consistency.putLockChain(address)
        return lock
      },
      unlockSystemInit: async ({ systemInitUuid: uuid, lock }) => {
        assert.strictEqual(typeof uuid, 'string')
        assert(lock instanceof Lock)
        assert(lock.block)
        const chainId = lock.block.getChainId()
        debug(`unlockSystemInit`)
        await consistency.putUnlockSystemInit({ uuid, chainId })
      },
      unlockChain: async ({ lock }) => {
        assert(lock instanceof Lock)
        assert(lock.block)
        debug(`unlockChain`, lock.block.getChainId().substring(0, 9))
        await consistency.putUnlockChain(lock)
      },
    },
  }

  return { machine, config }
}

export { initializeConfig }
