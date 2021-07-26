const assert = require('assert')
const memoize = require('lodash/memoize')
const debug = require('debug')('interblock:cfg:isolator')
const { assign } = require('xstate')
const { pure } = require('../../../w001-xstate-direct')
const {
  channelModel,
  interblockModel,
  blockModel,
  provenanceModel,
  dmzModel,
  lockModel,
  keypairModel,
  pierceSigner,
} = require('../../../w015-models')
const { networkProducer, channelProducer } = require('../../../w016-producers')
const { interpreterConfig } = require('./interpreterConfig')
const { definition } = require('../machines/isolator')
const crypto = require('../../../w012-crypto')
const pierceKeypair = keypairModel.create('PIERCE', crypto.pierceKeypair)

const isReduceable = ({ dmz }) => {
  // TODO check the time available, probably as a parallel transition
  assert(dmzModel.isModel(dmz))
  const isReduceable = dmz.rx()
  debug(`isReduceable`, isReduceable && isReduceable.event.type)
  return !!isReduceable
}
const isPiercable = ({ dmz, hasPierced }) => {
  assert(dmzModel.isModel(dmz))
  const { isPierced } = dmz.config // config might have changed during reduction
  const isPiercable = isPierced && !hasPierced
  debug(`isPiercable: %O`, isPiercable)
  return isPiercable
}
const createConfig = (isolation, consistency) => ({
  actions: {
    assignLock: assign({
      lock: (context, event) => {
        const { lock } = event.payload
        assert(lockModel.isModel(lock))
        assert(lock.block, `can only isolate for existing chains`)
        return lock
      },
    }),
    assignDmz: assign({
      dmz: ({ lock }, event) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        const { cachedDmz } = event.payload
        if (cachedDmz) {
          assert(dmzModel.isModel(cachedDmz))
          debug(`assignDmz using cache`)
          return cachedDmz
        }
        debug(`assignDmz using lock`)
        const dmz = lock.block.getDmz()
        return dmz
      },
    }),
    ingestInterblocks: assign({
      dmz: ({ lock, dmz }) => {
        assert(lockModel.isModel(lock))
        assert(dmzModel.isModel(dmz))
        const { interblocks } = lock
        const { config } = lock.block // do not use cachedDmz
        const network = networkProducer.ingestInterblocks(
          dmz.network,
          interblocks,
          config
        )
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    assignGenesisInterblock: assign({
      interblock: ({ lock }) => {
        assert(lockModel.isModel(lock))
        const { interblocks } = lock
        const interblock = interblocks[0]
        assert(interblock.isGenesisAttempt(), `Not genesis attempt`)
        debug(`assignGenesisInterblock`)
        return interblock
      },
    }),
    connectToParent: assign({
      dmz: ({ dmz, interblock }) => {
        assert(dmzModel.isModel(dmz))
        assert(dmz.network['..'].address.isUnknown(), `Target connected`)
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
        const { lineage } = event.data
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

        // TODO does this work with cachedDmz ?
        let pierceDmz = _extractPierceDmz(lock.block)

        let txChannel = pierceDmz.network['@@PIERCE_TARGET']
        assert(txChannel.address.equals(block.provenance.getAddress()))
        assert.strictEqual(txChannel.systemRole, 'PIERCE')
        debug(`generatePierceDmz piercings.length: `, piercings.length)

        piercings.requests.forEach((rxRequest) => {
          const request = rxRequest.getRequest()
          txChannel = channelProducer.txRequest(txChannel, request)
        })
        piercings.replies.forEach((rxReply) => {
          assert(rxReply.getAddress().equals(txChannel.address))
          const reply = rxReply.getReply()
          const index = rxReply.getIndex()
          txChannel = channelProducer.txReply(txChannel, reply, index)
        })

        const network = { ...pierceDmz.network, '@@PIERCE_TARGET': txChannel }
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
        const pierceBlockAddress = pierceBlock.provenance.getAddress()
        // TODO change this to be a loopback action processed by interpreter ?
        // TODO why would channel be asked to open and not exist already ?
        let ioChannel =
          dmz.network['.@@io'] ||
          channelModel.create(pierceBlockAddress, 'PIERCE')
        if (ioChannel.address.isUnknown()) {
          ioChannel = channelProducer.setAddress(ioChannel, pierceBlockAddress)
        }
        const ioAddress = ioChannel.address
        assert(ioAddress.equals(pierceBlockAddress))
        assert.strictEqual(ioChannel.systemRole, 'PIERCE')
        const network = { ...dmz.network, '.@@io': ioChannel }
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    ingestPierceBlock: assign({
      dmz: ({ dmz }, event) => {
        debug(`ingestPierceBlock`)
        const { pierceBlock } = event.data
        assert(blockModel.isModel(pierceBlock))
        assert(dmzModel.isModel(dmz))

        const ib = interblockModel.create(pierceBlock, '@@PIERCE_TARGET')
        const network = networkProducer.ingestInterblocks(
          dmz.network,
          [ib],
          dmz.config
        )
        assert(ib.equals(network['.@@io'].heavy))
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    unassignContainerId: assign({
      containerId: () => '',
    }),
  },
  guards: {
    isGenesis: ({ lock }) => {
      assert(lockModel.isModel(lock))
      assert(lock.block)
      const { block } = lock
      const isNotRoot = !block.network['..'].address.isRoot()
      const isGenesis = block.provenance.address.isGenesis() && isNotRoot
      debug(`isGenesis: `, isGenesis)
      return isGenesis
    },
    verifyLineage: ({ interblock }, event) => {
      const { lineage } = event.data
      assert(lineage.length)
      assert.strictEqual(interblock.getChainId(), lineage[0].getChainId())
      assert(!lineage[0].provenance.height)
      debug(`verifyLineage`)
      // TODO check lineage is complete in the dmz, but does not include the interblock
      // check the chain of lineage goes back to genesis

      return true
    },
    isDmzChangeable: (context) => {
      // incoming changes detected
      const { lock } = context
      assert(lockModel.isModel(lock))
      assert(lock.block)
      // TODO alter this to accomodate a pending promise
      const isPiercePending = isPiercable(context) && lock.isPiercingsPresent()
      const isDmzChangeable = isReduceable(context) || isPiercePending
      debug(`isDmzChangeable: ${isDmzChangeable}`)
      return isDmzChangeable
    },
    isReduceable,
    isPiercable,
    isPierceDmzChanged: ({ lock, pierceDmz }) => {
      if (!pierceDmz) {
        debug(`isPierceDmzChanged: `, pierceDmz)
        return false
      }
      assert(lockModel.isModel(lock))
      assert(lock.block)
      assert(dmzModel.isModel(pierceDmz))

      const currentPierceDmz = _extractPierceDmz(lock.block)
      const currentIo = currentPierceDmz.network['@@PIERCE_TARGET']
      const nextIo = pierceDmz.network['@@PIERCE_TARGET']
      const isPierceDmzChanged = nextIo.isTxGreaterThan(currentIo)
      debug(`isPierceDmzChanged: %o`, isPierceDmzChanged)
      // TODO what about if txRequest or txReply has increased from inside ?
      return isPierceDmzChanged
    },
    isPierceChannelUnopened: ({ dmz }) => {
      assert(dmzModel.isModel(dmz))
      const ioChannel = dmz.network['.@@io']
      const isPierceChannelUnopened =
        ioChannel && !ioChannel.address.isResolved()
      debug(`isPierceChannelUnopened`, isPierceChannelUnopened)
      return isPierceChannelUnopened
    },
    isCovenantEffectable: ({ lock, dmz }) => {
      assert(lockModel.isModel(lock))
      assert(dmzModel.isModel(dmz))
      let prevIo = channelModel.create()
      // TODO merge this into channelModel so can reuse in increasorConfig
      if (lock.block && lock.block.network['.@@io']) {
        prevIo = lock.block.network['.@@io']
      }
      const nextIo = dmz.network['.@@io'] || prevIo
      const nextIoIndices = nextIo
        .getRequestIndices()
        .filter((index) => !prevIo.requests[index])

      const isCovenantEffectable = nextIoIndices.length
      debug(`isCovenantEffectable`, isCovenantEffectable)
      return isCovenantEffectable
    },
  },
  services: {
    fetchParentLineage: async ({ interblock }) => {
      assert(interblockModel.isModel(interblock))
      const { provenance } = interblock
      const lineage = await consistency.getLineage({ provenance })
      assert(Array.isArray(lineage))
      assert(lineage.every(interblockModel.isModel))
      assert.strictEqual(lineage[0].provenance.height, 0)
      debug(`fetchParentLineage length: ${lineage.length}`)
      return { lineage }
    },
    loadCovenant: async ({ lock }) => {
      // TODO handle reusing containers that are already loaded from previous blocks
      assert(lockModel.isModel(lock))
      const containerId = await isolation.loadCovenant(lock.block)
      debug(`loadCovenant containerId: ${containerId.substring(0, 9)}`)
      return { containerId }
    },
    reduce: async ({ dmz, containerId }) => {
      assert(dmzModel.isModel(dmz))
      assert(dmz.rx())
      // TODO rename anvil to externalAction
      const { event: externalAction, channel } = dmz.rx()
      debug(`reduce: `, externalAction.type)
      const { address } = channel
      assert(!address.isUnknown())
      const tickPayload = { containerId, timeout: 30000 }
      const tick = (state, action, accumulator) =>
        isolation.tick({ ...tickPayload, state, action, accumulator })

      const { machine, config } = interpreterConfig(tick)
      const payload = { dmz, externalAction, address }
      const tickAction = { type: 'TICK', payload }
      const nextDmz = await pure(tickAction, machine, config)
      assert(dmzModel.isModel(nextDmz))
      return { nextDmz }
    },
    signPierceDmz: async ({ pierceDmz, lock }) => {
      assert(dmzModel.isModel(pierceDmz))
      assert(lockModel.isModel(lock))
      const { block } = lock
      assert(block)
      const previousProvenance = _getPierceProvenance(block)
      debug(`signPierceDmz with previous: %O`, !!previousProvenance)

      const extraLineages = {}
      const provenance = await provenanceModel.create(
        pierceDmz,
        previousProvenance,
        extraLineages,
        pierceSigner
      )
      const pierceBlock = blockModel.clone({ ...pierceDmz, provenance })
      return { pierceBlock }
    },
    unloadCovenant: async ({ containerId }) => {
      debug(`unloadCovenant containerId: %o`, containerId.substring(0, 9))
      await isolation.unloadCovenant(containerId)
    },
  },
})
const _extractPierceDmzRaw = (block) => {
  const validators = pierceKeypair.getValidatorEntry()
  const baseDmz = dmzModel.create({ validators })
  const address = block.provenance.getAddress()
  let pierceChannel = channelModel.create(address, 'PIERCE')
  if (block.network['.@@io'] && block.network['.@@io'].address.isResolved()) {
    const ioChannel = block.network['.@@io']
    const remote = ioChannel.getRemote()
    assert(remote && remote.address.equals(address))
    const { requests, replies } = remote
    const indices = ioChannel.getRemoteRequestIndices()
    const requestsLength = indices.length ? indices.pop() + 1 : 0
    const nextChannel = { ...pierceChannel, requests, replies, requestsLength }
    pierceChannel = channelModel.clone(nextChannel)
    const base = interblockModel.create(block, '.@@io')
    pierceChannel = channelProducer.ingestPierceInterblock(pierceChannel, base)
    while (pierceChannel.rxReply()) {
      pierceChannel = channelProducer.shiftTxRequest(pierceChannel)
    }
  }
  const network = { ...baseDmz.network, '@@PIERCE_TARGET': pierceChannel }
  return dmzModel.clone({ ...baseDmz, network })
}
const _extractPierceDmz = memoize(_extractPierceDmzRaw)
const _getPierceProvenance = (block) => {
  const ioChannel = block.network['.@@io']
  if (!ioChannel) {
    return undefined
  }
  const { provenance } = ioChannel.heavy
  assert(provenanceModel.isModel(provenance))
  return provenance
}

const isolatorConfig = (isolation, consistency) => {
  debug(`isolatorConfig`)
  const config = createConfig(isolation, consistency)
  return { machine: definition, config }
}

module.exports = { isolatorConfig }
