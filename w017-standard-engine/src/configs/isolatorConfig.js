const assert = require('assert')
const debug = require('debug')('interblock:config:isolator')
const { assign } = require('xstate')
const {
  channelModel,
  addressModel,
  interblockModel,
  blockModel,
  provenanceModel,
  rxRequestModel,
  dmzModel,
  lockModel,
  keypairModel,
  pierceSigner,
} = require('../../../w015-models')
const { networkProducer, channelProducer } = require('../../../w016-producers')
const { openPaths } = require('../../../w021-dmz-reducer')
const { thread } = require('../execution/thread')
const { interpreterConfig } = require('./interpreterConfig')
const { machine } = require('../machines/isolator')
const isolationProcessor = require('../services/isolateFactory')
const crypto = require('../../../w012-crypto')
const pierceKeypair = keypairModel.create('PIERCE', crypto.pierceKeypair)

const isReduceable = ({ dmz }) => {
  // TODO check the time available, probably as a parallel transition
  assert(dmzModel.isModel(dmz))
  const isReduceable = !!dmz.network.rx()
  debug(`isReduceable: ${isReduceable}`)
  return isReduceable
}
const isPiercable = ({ dmz, hasPierced }) => {
  assert(dmzModel.isModel(dmz))
  const { isPierced } = dmz.config // config might have changed during reduction
  const isPiercable = isPierced && !hasPierced
  debug(`isPiercable: %O`, isPiercable)
  return isPiercable
}
const isolatorMachine = machine.withConfig({
  actions: {
    assignLock: assign({
      lock: (context, event) => {
        const { lock } = event.payload
        assert(lockModel.isModel(lock))
        assert(lock.block, `can only isolate for existing chains`)
        return lock
      },
    }),
    primeDmz: assign({
      dmz: ({ lock }) => {
        assert(lockModel.isModel(lock))
        const { block, interblocks } = lock
        const dmz = block.getDmz()
        const network = networkProducer.ingestInterblocks(
          dmz.network,
          interblocks,
          dmz.config
        )
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    assignContainerId: assign({
      containerId: (context, event) => {
        const { containerId } = event.data
        assert(containerId)
        return containerId
      },
    }),
    updateDmz: assign({
      dmz: (context, event) => {
        debug(`updateDmz`)
        const { nextDmz } = event.data
        assert(dmzModel.isModel(nextDmz))
        return nextDmz
      },
    }),
    generatePierceDmz: assign({
      pierceDmz: ({ lock }) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        const { block, piercings } = lock

        let pierceDmz = extractPierceDmz(lock.block)

        // TODO remove all tx that have been replied to
        // TODO leave the highest tx in place, to serve as counter
        const ioChannel = block.network['@@io']

        let txChannel = pierceDmz.network['@@PIERCE_TARGET']
        assert(txChannel.address.equals(block.provenance.getAddress()))
        assert.strictEqual(txChannel.systemRole, 'PIERCE')
        piercings.forEach((action) => {
          txChannel = channelProducer.txRequest(txChannel, action)
          // TODO handle replies in the pierce queue
        })
        network = { ...pierceDmz.network, '@@PIERCE_TARGET': txChannel }
        pierceDmz = dmzModel.clone({ ...pierceDmz, network })
        return pierceDmz
      },
    }),
    assignHasPierced: assign({
      hasPierced: () => true,
    }),
    openPierceChannel: assign({
      dmz: ({ dmz }, event) => {
        debug(`openPierceChannel`)
        const { pierceBlock } = event.data
        assert(blockModel.isModel(pierceBlock))
        assert(dmzModel.isModel(dmz))
        const address = pierceBlock.provenance.getAddress()
        const ioChannel =
          dmz.network['@@io'] || channelModel.create(address, 'PIERCE')
        assert(ioChannel.address.equals(address))
        assert.strictEqual(ioChannel.systemRole, 'PIERCE')
        const network = { ...dmz.network, '@@io': ioChannel }
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    ingestPierceBlock: assign({
      dmz: ({ dmz }, event) => {
        debug(`ingestPierceBlock`)
        const { pierceBlock } = event.data
        assert(blockModel.isModel(pierceBlock))
        assert(dmzModel.isModel(dmz))

        const network = networkProducer.ingestInterblocks(
          dmz.network,
          [interblockModel.create(pierceBlock, '@@PIERCE_TARGET')],
          dmz.config
        )
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    openPaths: assign({
      dmz: ({ dmz }) => {
        debug(`openPaths`)
        assert(dmzModel.isModel(dmz))
        const network = openPaths(dmz.network)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
  },
  guards: {
    isDmzChangeable: (context) => {
      // incoming changes detected
      const { lock } = context
      assert(lockModel.isModel(lock))
      assert(lock.block)
      const isPiercePending = isPiercable(context) && lock.piercings.length
      const isDmzChangeable = isReduceable(context) || isPiercePending
      debug(`isDmzChangeable: ${isDmzChangeable}`)
      return isDmzChangeable
    },
    isReduceable,
    isPiercable,
    isPierceDmzChanged: ({ lock, pierceDmz }) => {
      assert(lockModel.isModel(lock))
      assert(lock.block)
      assert(dmzModel.isModel(pierceDmz))

      const currentPierceDmz = extractPierceDmz(lock.block)
      const currentIo = currentPierceDmz.network['@@PIERCE_TARGET']
      const nextIo = pierceDmz.network['@@PIERCE_TARGET']
      const isPierceDmzChanged = nextIo.isTxGreaterThan(currentIo)
      debug(`isPierceDmzChanged: %o`, isPierceDmzChanged)
      return isPierceDmzChanged
    },
  },
  services: {
    loadCovenant: async ({ lock, isolation }) => {
      assert(lockModel.isModel(lock))
      const containerId = await isolation.loadCovenant(lock.block)
      debug(`loadCovenant containerId: ${containerId.substring(0, 9)}`)
      return { containerId }
    },
    reduce: async ({ dmz, containerId, isolation }) => {
      assert(dmzModel.isModel(dmz))
      assert(dmz.network.rx())
      const { event: anvil, channel } = dmz.network.rx()
      const nextReplyIndex = channel.getNextReplyIndex()
      debug(`reduce: `, anvil.type, nextReplyIndex)
      const { address } = channel
      assert(!address.isUnknown())
      const tick = createTick(containerId, isolation.tick)
      const interpreter = interpreterConfig(tick, dmz, anvil, address)
      const nextDmz = await thread('TICK', interpreter)
      assert(dmzModel.isModel(nextDmz))
      return { nextDmz }
    },
    signPierceDmz: async ({ pierceDmz, lock }) => {
      assert(dmzModel.isModel(pierceDmz))
      assert(lockModel.isModel(lock))
      const { block } = lock
      assert(block)

      const previousProvenance = getPierceProvenance(block)
      const extraLineage = undefined
      const provenance = await provenanceModel.create(
        pierceDmz,
        previousProvenance,
        extraLineage,
        pierceSigner
      )
      const pierceBlock = blockModel.clone({ ...pierceDmz, provenance })
      return { pierceBlock }
    },
    unloadCovenant: async ({ containerId, isolation }) => {
      debug(`unloadCovenant containerId: %o`, containerId.substring(0, 9))
      await isolation.unloadCovenant(containerId)
    },
  },
})
const extractPierceDmz = (block) => {
  const ioChannel = block.network['@@io']
  const validators = pierceKeypair.getValidatorEntry()
  const baseDmz = dmzModel.create({ validators })
  const address = block.provenance.getAddress()
  let pierceChannel = channelModel.create(address, 'PIERCE')
  if (ioChannel) {
    const remote = ioChannel.getRemote()
    assert(remote)
    assert(remote.address.equals(address))
    const { requests, replies } = remote
    const indices = ioChannel.getRemoteRequestIndices()
    assert(indices.length)
    const requestsLength = indices.pop() + 1
    const nextChannel = { ...pierceChannel, requests, replies, requestsLength }
    pierceChannel = channelModel.clone(nextChannel)
  }
  const network = { ...baseDmz.network, '@@PIERCE_TARGET': pierceChannel }
  return dmzModel.clone({ ...baseDmz, network })
}
const getPierceProvenance = (block) => {
  const ioChannel = block.network['@@io']
  if (!ioChannel) {
    return undefined
  }
  const { provenance } = ioChannel.heavy
  assert(provenanceModel.isModel(provenance))
  return provenance
}

const isolatorConfig = (ioIsolate) => {
  const isolation = isolationProcessor.toFunctions(ioIsolate)
  return isolatorMachine.withContext({ isolation })
}

const createTick = (containerId, tick) => (state, action) =>
  tick({ containerId, state, action })
module.exports = { isolatorConfig }
