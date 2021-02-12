const assert = require('assert')
const debug = require('debug')('interblock:cfg:pool')
const _ = require('lodash')
const { assign } = require('xstate')
const { definition } = require('../machines/pool')
const {
  channelModel,
  networkModel,
  blockModel,
  lockModel,
  interblockModel,
  addressModel,
  dmzModel,
  covenantIdModel,
  publicKeyModel,
} = require('../../../w015-models')
const { lockProducer } = require('../../../w016-producers')
const consistencyProcessor = require('../services/consistencyFactory')
const cryptoProcessor = require('../services/cryptoFactory')

const poolConfig = (ioCrypto, ioConsistency) => {
  const consistency = consistencyProcessor.toFunctions(ioConsistency)
  const crypto = cryptoProcessor.toFunctions(ioCrypto)
  const config = {
    actions: {
      dumpAffected: assign({
        affectedAddresses: ({ affectedAddresses, interblock }) => {
          assert(Array.isArray(affectedAddresses))
          assert(interblockModel.isModel(interblock))
          if (!interblock.getOriginAlias()) {
            // TODO move to state machine
            return []
          }
          return [interblock.getTargetAddress()]
        },
      }),
      assignInterblock: assign({
        interblock: (context, event) => {
          const interblock = event.payload
          assert(interblockModel.isModel(interblock))
          return interblock
        },
      }),
      assignLock: assign({
        lock: (context, event) => {
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
      assignAffectedAddresses: assign({
        affectedAddresses: ({ affectedAddresses }, event) => {
          debug(`assignAffectedAddresses`)
          const affected = event.data
          assert(Array.isArray(affected))
          return [...affected, ...affectedAddresses]
        },
      }),
      assignConnectionAttempt: assign({
        affectedAddresses: ({ interblock, affectedAddresses }) => {
          assert(Array.isArray(affectedAddresses))
          assert(interblockModel.isModel(interblock))
          const targetAddress = interblock.getTargetAddress()
          return [...affectedAddresses, targetAddress]
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
        let isGenesis = false
        try {
          interblock.extractGenesis()
          isGenesis = true
        } catch (e) {}
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
      isConnectionAttempt: ({ interblock }) => interblock.isConnectionAttempt(),
      isConnectable: (context, event) => event.data,
    },
    services: {
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
        debug(`signBlock`)
        const block = await blockModel.create(baseDmz, crypto.sign)
        return block
      },
      lockBaseChain: async ({ nextBlock }) => {
        debug(`lockBaseChain`)
        const address = nextBlock.provenance.getAddress()
        const lock = await consistency.putLockChain(address)
        return lock
      },
      fetchAffectedAddresses: async ({ interblock }) => {
        const affected = await consistency.getAffected(interblock)
        if (interblock.isGenesisAttempt()) {
          const genesis = interblock.extractGenesis()
          assert(blockModel.isModel(genesis))
          const genesisAddress = genesis.provenance.getAddress()
          assert(affected.every((address) => !address.equals(genesisAddress)))
          affected.push(genesisAddress)
        }
        debug(`fetchAffectedAddresses: ${affected.length}`)
        return affected
      },
      isConnectable: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const address = interblock.getTargetAddress()
        assert(address)
        const latest = await consistency.getBlock({ address })
        if (latest) {
          assert(blockModel.isModel(latest))
        }
        const isConnectable = latest && latest.config.isPublicChannelOpen
        debug(`isConnectable: `, isConnectable)
        return isConnectable
      },
      storeInPools: async ({ interblock, affectedAddresses }) => {
        assert(Array.isArray(affectedAddresses))
        assert(interblockModel.isModel(interblock))
        debug(`storeInPools`)
        await consistency.putPoolInterblock({
          affectedAddresses,
          interblock,
        })
        debug(`storeInPools completed on ${affectedAddresses.length} items`)
      },
    },
  }
  return { machine: definition, config }
}

module.exports = { poolConfig }
