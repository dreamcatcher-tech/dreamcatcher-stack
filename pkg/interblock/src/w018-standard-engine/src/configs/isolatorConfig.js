import assert from 'assert-fast'
import { assign } from 'xstate'
import { pure } from '../../../w001-xstate-direct'
import {
  Channel,
  Interblock,
  Block,
  Dmz,
  Lock,
  Conflux,
  RxReply,
  RxRequest,
  Piercings,
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
        assert(lock instanceof Lock)
        assert(lock.block, `can only isolate for existing chains`)
        debug(`assignLock`)
        return lock
      },
    }),
    assignDmz: assign({
      dmz: ({ lock }) => {
        assert(lock instanceof Lock)
        assert(lock.block)
        debug(`assignDmz using lock`)
        const dmz = lock.block.getDmz()
        return dmz
      },
    }),
    assignInterblocks: assign({
      interblocks: ({ lock }) => {
        assert(lock instanceof Lock)
        debug(`assignInterblocks`, lock.interblocks.length)
        return lock.interblocks
      },
    }),
    ingestInterblocks: assign((context) => {
      debug(`ingestInterblocks`)
      assert.strictEqual(typeof context.conflux, 'undefined')
      const { dmz, interblocks } = context
      assert(dmz instanceof Dmz)
      assert(Array.isArray(interblocks))
      assert(interblocks.every((v) => v instanceof Interblock))
      const { config } = dmz
      const [network, conflux] = networkProducer.ingestInterblocks(
        dmz.network,
        interblocks,
        config
      )
      return { ...context, dmz: dmz.update({ network }), conflux }
    }),
    connectToParent: assign({
      dmz: ({ dmz, interblocks }) => {
        assert(dmz instanceof Dmz)
        assert(Array.isArray(interblocks))
        assert(interblocks.every((v) => v instanceof Interblock))
        assert(dmz.network.get('..').address.isUnknown(), `Target connected`)
        debug(`connectToParent`)

        const [interblock] = interblocks
        assert(interblock.isGenesisAttempt(), `Not genesis attempt`)
        const address = interblock.provenance.getAddress()
        let parent = dmz.network.get('..')
        parent = channelProducer.setAddress(parent, address)
        const network = dmz.network.set('..', parent)
        return dmz.update({ network })
      },
    }),
    zeroTransmissions: assign({
      dmz: ({ lock, dmz }) => {
        assert(lock instanceof Lock)
        assert(dmz instanceof Dmz)
        debug(`zeroTransmissions`)
        const precedent = lock.block.provenance.reflectIntegrity()
        const network = networkProducer.zeroTransmissions(
          dmz.network,
          precedent
        )
        return dmz.update({ network })
      },
    }),
    blankPiercings: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        debug(`blankPiercings`)
        return dmz.delete('piercings')
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
        assert(nextDmz instanceof Dmz)
        return nextDmz
      },
    }),
    zeroLoopback: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        debug(`zeroLoopback`)
        let loopback = dmz.network.get('.')
        loopback = channelProducer.zeroLoopback(loopback)
        const network = dmz.network.set('.', loopback)
        return dmz.update({ network })
      },
    }),
    generatePierceDmz: assign({
      pierceDmz: ({ lock }) => {
        assert(lock instanceof Lock)
        assert(lock.isPiercingsPresent())
        assert(lock.block)
        const { replies, requests } = lock.piercings
        debug(`generatePierceDmz`)
        return dmzProducer.generatePierceDmz(lock.block, replies, requests)
      },
    }),
    generatePierceBlock: assign({
      pierceBlock: ({ lock, pierceDmz }) => {
        assert(lock instanceof Lock)
        assert(pierceDmz instanceof Dmz)
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
        assert(interblocks.every((v) => v instanceof Interblock))
        const pierced = Interblock.create(pierceBlock, '@@PIERCE_TARGET')
        return [...interblocks, pierced]
      },
    }),
    injectReplayablePiercings: assign({
      dmz: ({ dmz, pierceBlock }) => {
        assert(dmz instanceof Dmz)
        assert(pierceBlock instanceof Block)
        debug(`injectReplayablePiercings`)
        const ioChannel = pierceBlock.network.get('@@PIERCE_TARGET')
        const { replies, requests } = ioChannel
        const piercings = Piercings.create(replies, requests)
        return dmz.update({ piercings })
      },
    }),
    openPierceChannel: assign({
      dmz: ({ dmz, pierceBlock }) => {
        assert(dmz instanceof Dmz)
        assert(pierceBlock instanceof Block)
        debug(`openPierceChannel`)
        const ioAddress = pierceBlock.provenance.getAddress()
        let ioChannel
        if (!dmz.network.has('.@@io')) {
          ioChannel = Channel.create(ioAddress, 'PIERCE')
        } else {
          ioChannel = dmz.network.get('.@@io')
        }
        if (ioChannel.address.isUnknown()) {
          debug(`address unknown`)
          // TODO ? is this ever the case ?
          ioChannel = channelProducer.setAddress(ioChannel, ioAddress)
        }
        assert(ioChannel.address.deepEquals(ioAddress))
        assert.strictEqual(ioChannel.systemRole, 'PIERCE')
        const network = dmz.network.update({ '.@@io': ioChannel })
        return dmz.update({ network })
      },
    }),
    selectAction: assign({
      rxAction: ({ dmz, conflux, rxIndex }) => {
        assert(dmz instanceof Dmz)
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
          const bufferedRequest = pending.rxBufferedRequest()
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
      assert(lock instanceof Lock)
      assert(lock.block)
      const { block } = lock
      const isNotRoot = !block.network.get('..').address.isRoot()
      const isGenesis = isNotRoot && block.provenance.address.isGenesis()
      debug(`isGenesis: `, isGenesis)
      return isGenesis
    },
    isReduceable: ({ rxAction }) => {
      // TODO check the time available, probably as a parallel transition
      if (rxAction) {
        assert(rxAction instanceof RxReply || rxAction instanceof RxRequest)
      }
      const isReduceable = !!rxAction
      debug(`isReduceable`, isReduceable)
      return isReduceable
    },
    isPierceable: ({ lock, dmz }) => {
      assert(lock instanceof Lock)
      assert(dmz instanceof Dmz)
      // ! config might have changed during reduction
      const isPiercable = dmz.config.isPierced && lock.isPiercingsPresent()
      debug(`isPiercable: %O`, isPiercable)
      return isPiercable
    },
    isPierceChannelUnopened: ({ dmz }) => {
      assert(dmz instanceof Dmz)
      const ioChannel = dmz.network.get('.@@io')
      const isPierceChannelUnopened =
        !ioChannel || !ioChannel.address.isResolved()
      debug(`isPierceChannelUnopened`, isPierceChannelUnopened)
      return isPierceChannelUnopened
    },
    isCovenantEffectable: ({ lock, dmz }) => {
      // TODO merge this into Channel so can reuse in increasorConfig
      assert(lock instanceof Lock)
      assert(dmz instanceof Dmz)
      const io = dmz.network.get('.@@io')
      const isCovenantEffectable = !!(io && io.requests.length)
      debug(`isCovenantEffectable`, isCovenantEffectable)
      return isCovenantEffectable
    },
  },
  services: {
    loadCovenant: async ({ lock }) => {
      // TODO handle reusing containers that are already loaded from previous blocks
      assert(lock instanceof Lock)
      const containerId = await isolation.loadCovenant(lock.block)
      debug(`loadCovenant containerId: ${containerId.substring(0, 9)}`)
      return { containerId }
    },
    reduce: async ({ dmz, containerId, rxAction }) => {
      assert(dmz instanceof Dmz)
      assert.strictEqual(typeof containerId, 'string')
      assert(rxAction instanceof RxReply || rxAction instanceof RxRequest)
      // TODO rename anvil to externalAction
      debug(`reduce: `, rxAction.getLogEntry())
      const tickPayload = { containerId, timeout: 30000 }
      const tick = (state, action, accumulator = []) =>
        isolation.tick({ ...tickPayload, state, action, accumulator })

      const { machine, config } = interpreterConfig(tick)
      const action = { type: 'TICK', payload: { dmz, rxAction } }
      const nextDmz = await pure(action, machine, config)
      assert(nextDmz instanceof Dmz)
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
