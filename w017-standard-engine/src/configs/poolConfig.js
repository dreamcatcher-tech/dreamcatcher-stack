const assert = require('assert')
const debug = require('debug')('interblock:config:pool')
const _ = require('lodash')
const { assign } = require('xstate')
const { machine } = require('../machines/pool')
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
  provenanceModel,
} = require('../../../w015-models')
const {
  blockProducer,
  lockProducer,
  channelProducer,
  networkProducer,
} = require('../../../w016-producers')
const { generateNext } = blockProducer
const consistencyProcessor = require('../services/consistencyFactory')
const cryptoProcessor = require('../services/cryptoFactory')

const poolConfig = (ioCrypto, ioConsistency) => {
  const consistency = consistencyProcessor.toFunctions(ioConsistency)
  const crypto = cryptoProcessor.toFunctions(ioCrypto)
  return machine.withConfig({
    actions: {
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
      assignDmz: assign({
        dmz: ({ lock }) => {
          assert(lockModel.isModel(lock))
          const dmz = lock.block && lock.block.getDmz()
          return dmz
        },
      }),
      assignNextBlock: assign({
        nextBlock: ({ lock }) => {
          assert(lockModel.isModel(lock))
          return lock.block // may be undefined
        },
      }),
      mergeGenesis: assign({
        nextBlock: ({ lock, interblock }) => {
          debug(`mergeGenesis`)
          assert(lockModel.isModel(lock))
          assert(interblockModel.isModel(interblock))
          const nextBlock = interblock.extractGenesis()
          return nextBlock
        },
      }),
      connectToParent: assign({
        dmz: ({ interblock, dmz }) => {
          debug(`connectToParent`)
          const address = interblock.provenance.getAddress()
          let parent = dmz.network['..']
          parent = channelProducer.setAddress(parent, address)
          const network = { ...dmz.network, '..': parent }
          return dmzModel.clone({ ...dmz, network })
        },
      }),
      ingestParentLineage: assign({
        dmz: ({ dmz }, event) => {
          const lineage = event.data
          assert(Array.isArray(lineage))
          assert(lineage.every(interblockModel.isModel))
          debug(`ingestParentLineage length: ${lineage.length}`)
          const network = networkProducer.ingestInterblocks(
            dmz.network,
            lineage,
            dmz.config
          )
          dmz = dmzModel.clone({ ...dmz, network })
          return dmz
        },
      }),
      mergeBlockToLock: assign({
        lock: ({ lock, nextBlock }) => {
          assert(lockModel.isModel(lock))
          assert(blockModel.isModel(nextBlock))
          debug(`mergeBlockToLock increased: ${lock.block !== nextBlock}`)
          const nextLock = lockProducer.reconcile(lock, nextBlock)
          return nextLock
        },
      }),
      assignInitializedAddress: assign({
        affectedAddresses: ({ lock }) => [lock.block.provenance.getAddress()],
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
          const hyper = addressModel.create('ROOT')
          const sealedRoot = channelModel.create(hyper)
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
        const isStorageEmpty = event.data
        debug(`isStorageEmpty: ${isStorageEmpty}`)
        return isStorageEmpty
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
        const otherBlocks = lock.block && lock.block.provenance.height >= 1
        debug(`isBirthingCompleted: ${otherBlocks}`)
        return otherBlocks
      },
      verifyLineage: ({ interblock }, event) => {
        const lineage = event.data
        assert(lineage.length)
        assert.equal(interblock.getChainId(), lineage[0].getChainId())
        assert(!lineage[0].provenance.height)
        debug(`verifyLineage`)
        // TODO check lineage is complete in the dmz, but does not include the interblock
        // check the chain of lineage goes back to genesis

        return true
      },
      isLockForGenesis: ({ lock }) => {
        assert(lockModel.isModel(lock))
        const { block } = lock
        const isLockForGenesis = block && block.provenance.address.isGenesis()
        debug(`isLockForGenesis: ${isLockForGenesis}`)
        return isLockForGenesis
      },
      isLockForBirthBlock: ({ lock }) => {
        assert(lockModel.isModel(lock))
        const { block } = lock
        const isLockForBirthBlock = block && block.provenance.height === 1
        debug(`isLockForBirthBlock: ${isLockForBirthBlock}`)
        return isLockForBirthBlock
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
        debug(`isStorageEmpty: ${!firstBlock}`)
        return !firstBlock
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
        debug(`lockChildChain: ${!!lock}`)
        return lock
      },
      fetchParentLineage: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const { provenance } = interblock
        const lineage = await consistency.getLineage({ provenance })
        assert(Array.isArray(lineage))
        assert(lineage.every(interblockModel.isModel))
        assert.equal(lineage[0].provenance.height, 0)
        debug(`fetchParentLineage length: ${lineage.length}`)
        return lineage
      },
      generateBirthBlock: async ({ dmz, lock }) => {
        assert(dmzModel.isModel(dmz))
        assert(lockModel.isModel(lock))
        debug(`generateBirthBlock`)
        const nextBlock = await generateNext(dmz, lock.block, crypto.sign)
        return nextBlock
      },
      unlockChain: async ({ lock }) => {
        assert(lockModel.isModel(lock))
        debug(`unlockChain`)
        const isRedriveRequired = await consistency.putUnlockChain(lock)
        return
      },
      poolBirthBlock: async ({ lock }) => {
        assert(lockModel.isModel(lock))
        const { block } = lock
        assert(block)
        assert(block.provenance.height === 1)
        const { address } = block.network['..']
        assert(address.isResolved())
        const interblock = interblockModel.create(block)
        const affectedAddresses = [address]
        await consistency.putPoolInterblock({
          affectedAddresses,
          interblock,
        })
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
  })
}

module.exports = { poolConfig }
