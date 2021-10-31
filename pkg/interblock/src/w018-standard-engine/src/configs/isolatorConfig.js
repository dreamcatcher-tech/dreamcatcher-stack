import assert from 'assert-fast'
import { assign } from 'xstate'
import { pure } from '../../../w001-xstate-direct'
import {
  channelModel,
  interblockModel,
  blockModel,
  dmzModel,
  lockModel,
  Conflux,
  rxReplyModel,
  rxRequestModel,
} from '../../../w015-models'
import {
  dmzProducer,
  channelProducer,
  networkProducer,
  blockProducer,
} from '../../../w016-producers'
import { interpreterConfig } from './interpreterConfig'
import { isolatorMachine } from '../machines'
import Debug from 'debug'
const debug = Debug('interblock:cfg:isolator')

const createConfig = (isolation, consistency) => ({
  actions: {
    assignLock: assign({
      lock: (context, event) => {
        const { lock } = event.payload
        assert(lockModel.isModel(lock))
        assert(lock.block, `can only isolate for existing chains`)
        debug(`assignLock`)
        return lock
      },
    }),
    assignDmz: assign({
      dmz: ({ lock }) => {
        assert(lockModel.isModel(lock))
        assert(lock.block)
        debug(`assignDmz using lock`)
        const dmz = lock.block.getDmz()
        return dmz
      },
    }),
    assignInterblocks: assign({
      interblocks: ({ lock }) => {
        assert(lockModel.isModel(lock))
        debug(`assignInterblocks`, lock.interblocks.length)
        return lock.interblocks
      },
    }),
    ingestInterblocks: assign((context) => {
      debug(`ingestInterblocks`)
      assert.strictEqual(typeof context.conflux, 'undefined')
      const { dmz, interblocks } = context
      assert(dmzModel.isModel(dmz))
      assert(Array.isArray(interblocks))
      assert(interblocks.every(interblockModel.isModel))
      const { config } = dmz
      const [network, conflux] = networkProducer.ingestInterblocks(
        dmz.network,
        interblocks,
        config
      )
      return { ...context, dmz: dmzModel.clone({ ...dmz, network }), conflux }
    }),
    connectToParent: assign({
      dmz: ({ dmz, interblocks }) => {
        assert(dmzModel.isModel(dmz))
        assert(Array.isArray(interblocks))
        assert(interblocks.every(interblockModel.isModel))
        assert(dmz.network['..'].address.isUnknown(), `Target connected`)
        debug(`connectToParent`)

        const [interblock] = interblocks
        assert(interblock.isGenesisAttempt(), `Not genesis attempt`)
        const address = interblock.provenance.getAddress()
        let parent = dmz.network['..']
        parent = channelProducer.setAddress(parent, address)
        const network = dmz.network.merge({ '..': parent })
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    zeroTransmissions: assign({
      dmz: ({ lock, dmz }) => {
        assert(lockModel.isModel(lock))
        assert(dmzModel.isModel(dmz))
        debug(`zeroTransmissions`)
        const precedent = lock.block.provenance.reflectIntegrity()
        const network = networkProducer.zeroTransmissions(
          dmz.network,
          precedent
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
    inductRequestBlocks: assign({
      conflux: ({ conflux }, event) => {
        // TODO move conflux to be an immutable structure somehow
        assert(conflux instanceof Conflux)
        const { requestBlocks } = event.data
        assert(Array.isArray(requestBlocks))
        assert(requestBlocks.every(blockModel.isModel))
        debug(`inductRequestBlocks`)
        conflux.inductRequestBlocks(requestBlocks)
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
    zeroLoopback: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        debug(`zeroLoopback`)
        const loopback = channelProducer.zeroLoopback(dmz.network['.'])
        return dmzModel.clone({
          ...dmz,
          network: { ...dmz.network, '.': loopback },
        })
      },
    }),
    generatePierceDmz: assign({
      pierceDmz: ({ lock }) => {
        assert(lockModel.isModel(lock))
        assert(lock.isPiercingsPresent())
        assert(lock.block)
        const { replies, requests } = lock.piercings
        debug(`generatePierceDmz`)
        return dmzProducer.generatePierceDmz(lock.block, replies, requests)
      },
    }),
    generatePierceBlock: assign({
      pierceBlock: ({ lock, pierceDmz }) => {
        assert(lockModel.isModel(lock))
        assert(dmzModel.isModel(pierceDmz))
        assert(lock.block)
        const { block } = lock
        const pierceBlock = blockProducer.generatePierceBlock(pierceDmz, block)
        debug(`generatePierceBlock height: %O`, pierceBlock.getHeight())
        return pierceBlock
      },
    }),
    pushPierceInterblock: assign({
      interblocks: ({ interblocks, pierceBlock }) => {
        assert(Array.isArray(interblocks))
        assert(interblocks.every(interblockModel.isModel))
        const pierced = interblockModel.create(pierceBlock, '@@PIERCE_TARGET')
        return [...interblocks, pierced]
      },
    }),
    openPierceChannel: assign({
      dmz: ({ dmz, pierceBlock }) => {
        assert(dmzModel.isModel(dmz))
        assert(blockModel.isModel(pierceBlock))
        debug(`openPierceChannel`)
        const pAddress = pierceBlock.provenance.getAddress()
        let ioChannel =
          dmz.network['.@@io'] || channelModel.create(pAddress, 'PIERCE')
        if (ioChannel.address.isUnknown()) {
          debug(`address unknown`)
          // TODO ? is this ever the case ?
          ioChannel = channelProducer.setAddress(ioChannel, pAddress)
        }
        assert(ioChannel.address.equals(pAddress))
        assert.strictEqual(ioChannel.systemRole, 'PIERCE')
        const network = dmz.network.merge({ '.@@io': ioChannel })
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    selectAction: assign({
      rxAction: ({ dmz, conflux, rxIndex }) => {
        assert(dmzModel.isModel(dmz))
        assert(conflux instanceof Conflux)
        assert(Number.isInteger(rxIndex))
        assert(rxIndex >= 0)
        debug(`selectAction begin at rxIndex:`, rxIndex)

        if (rxIndex < conflux.rxReplies.length) {
          debug(`selectAction reply index:`, rxIndex)
          return conflux.rxReplies[rxIndex]
        }

        const { pending } = dmz
        if (!pending.getIsPending()) {
          const bufferedRequest = pending.rxBufferedRequest(dmz.network)
          if (bufferedRequest) {
            return bufferedRequest
          }
        }

        const rxRequestsIndex = rxIndex - conflux.rxReplies.length
        if (rxRequestsIndex < conflux.rxRequests.length) {
          debug(`selectAction request index:`, rxRequestsIndex)
          return conflux.rxRequests[rxRequestsIndex]
        }
        debug(`no action found`)
      },
    }),
    incrementRxIndex: assign({
      rxIndex: ({ rxIndex }) => {
        assert(Number.isInteger(rxIndex))
        assert(rxIndex >= 0)
        rxIndex++
        debug(`incrementRxIndex: `, rxIndex)
        return rxIndex
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
    isRequestBlocksRequired: ({ conflux }) => {
      const isRequestBlocksRequired = !!conflux.requiredBlockHeights.length
      debug(`isRequestBlocksRequired`, isRequestBlocksRequired)
    },
    isReduceable: ({ rxAction }) => {
      // TODO check the time available, probably as a parallel transition
      if (rxAction) {
        assert(
          rxReplyModel.isModel(rxAction) || rxRequestModel.isModel(rxAction)
        )
      }
      const isReduceable = !!rxAction
      debug(`isReduceable`, isReduceable)
      return isReduceable
    },
    isPierceable: ({ lock, dmz }) => {
      assert(lockModel.isModel(lock))
      assert(dmzModel.isModel(dmz))
      // ! config might have changed during reduction
      const isPiercable = dmz.config.isPierced && lock.isPiercingsPresent()
      debug(`isPiercable: %O`, isPiercable)
      return isPiercable
    },
    isPierceChannelUnopened: ({ dmz }) => {
      assert(dmzModel.isModel(dmz))
      const ioChannel = dmz.network['.@@io']
      const isPierceChannelUnopened =
        !ioChannel || !ioChannel.address.isResolved()
      debug(`isPierceChannelUnopened`, isPierceChannelUnopened)
      return isPierceChannelUnopened
    },
    isCovenantEffectable: ({ lock, dmz }) => {
      // TODO merge this into channelModel so can reuse in increasorConfig
      assert(lockModel.isModel(lock))
      assert(lock.block)
      assert(dmzModel.isModel(dmz))
      const io = lock.block.network['.@@io']
      const isCovenantEffectable = !!(io && io.requests.length)
      debug(`isCovenantEffectable`, isCovenantEffectable)
      return isCovenantEffectable
    },
  },
  services: {
    loadCovenant: async ({ lock }) => {
      // TODO handle reusing containers that are already loaded from previous blocks
      assert(lockModel.isModel(lock))
      const containerId = await isolation.loadCovenant(lock.block)
      debug(`loadCovenant containerId: ${containerId.substring(0, 9)}`)
      return { containerId }
    },
    reduce: async ({ dmz, containerId, rxAction }) => {
      assert(dmzModel.isModel(dmz))
      assert.strictEqual(typeof containerId, 'string')
      assert(rxReplyModel.isModel(rxAction) || rxRequestModel.isModel(rxAction))
      // TODO rename anvil to externalAction
      debug(`reduce: `, rxAction.type)
      const tickPayload = { containerId, timeout: 30000 }
      const tick = (state, action, accumulator) =>
        isolation.tick({ ...tickPayload, state, action, accumulator })

      const { machine, config } = interpreterConfig(tick)
      const action = { type: 'TICK', payload: { dmz, rxAction } }
      const nextDmz = await pure(action, machine, config)
      assert(dmzModel.isModel(nextDmz))
      return { nextDmz }
    },
    unloadCovenant: async ({ containerId }) => {
      assert.strictEqual(typeof containerId, 'string')
      debug(`unloadCovenant containerId: %o`, containerId.substring(0, 9))
      await isolation.unloadCovenant(containerId)
    },
  },
})

const isolatorConfig = (isolation, consistency) => {
  debug(`isolatorConfig`)
  const config = createConfig(isolation, consistency)
  return { machine: isolatorMachine, config }
}

export { isolatorConfig }
