const assert = require('assert')
const debug = require('debug')('interblock:config:isolator')
const truncate = require('cli-truncate')
const { assign } = require('xstate')
const { rxRequestModel, dmzModel, lockModel } = require('../../../w015-models')
const { networkProducer } = require('../../../w016-producers')
const { thread } = require('../execution/thread')
const { interpreterConfig } = require('./interpreterConfig')
const { machine } = require('../machines/isolator')
const isolationProcessor = require('../services/isolateFactory')

const isolatorConfig = (ioIsolate) => {
  const isolation = isolationProcessor.toFunctions(ioIsolate)
  return machine.withConfig({
    actions: {
      assignLock: assign({
        lock: (context, event) => {
          const lock = event.payload
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
          const containerId = event.data
          return containerId
        },
      }),
      updateDmz: assign({
        dmz: (context, event) => {
          debug(`updateDmz`)
          const nextDmz = event.data
          assert(dmzModel.isModel(nextDmz))
          return nextDmz
        },
      }),
    },
    guards: {
      isDmzChangeable: ({ dmz }) => {
        // incoming changes detected
        assert(dmzModel.isModel(dmz))
        const { isPierced } = dmz.config
        const rx = dmz.network.rx()
        const isDmzChangeable = isPierced || rx
        debug(`isDmzChangeable: ${isDmzChangeable}`)
        return isDmzChangeable
      },
      isExhausted: ({ dmz }) => {
        // TODO check the time available, probably as a parallel transition
        assert(dmzModel.isModel(dmz))
        const isExhausted = !dmz.network.rx()
        debug(`isExhausted: ${isExhausted}`)
        return isExhausted
      },
    },
    services: {
      loadCovenant: async ({ lock }) => {
        assert(lockModel.isModel(lock))
        const containerId = await isolation.loadCovenant(lock.block)
        debug(`loadCovenant containerId: ${containerId.substring(0, 9)}`)
        return containerId
      },
      reduceActionless: async ({ dmz, containerId }) => {
        debug(`reduceActionless`)
        assert(dmzModel.isModel(dmz))
        const address = dmz.network['.'].address
        const anvil = createTimestampAnvil(address)
        const tick = createTick(containerId, isolation.tick)
        const interpreter = interpreterConfig(tick, dmz, anvil, address)
        const nextDmz = await thread('TICK', interpreter)
        // TODO destroy debug object
        assert(dmzModel.isModel(nextDmz))
        return nextDmz
      },
      reduce: async ({ dmz, containerId }) => {
        assert(dmzModel.isModel(dmz))
        assert(dmz.network.rx())
        const { event: anvil, channel, alias } = dmz.network.rx()
        const nextReplyIndex = channel.getNextReplyIndex()
        debug(`reduce: `, anvil.type, nextReplyIndex)
        const { address } = channel
        assert(!address.isUnknown())
        const tick = createTick(containerId, isolation.tick)
        const interpreter = interpreterConfig(tick, dmz, anvil, address)
        const nextDmz = await thread('TICK', interpreter)
        assert(dmzModel.isModel(nextDmz))
        return nextDmz
      },
      unloadCovenant: async ({ containerId }) => {
        debug(`unloadCovenant containerId: ${truncate(containerId, 9)}`)
        await isolation.unloadCovenant(containerId)
      },
    },
  })
}

const createTick = (containerId, tick) => (state, action) =>
  tick({ containerId, state, action })
const createTimestampAnvil = (address) =>
  rxRequestModel.create('@@TIMESTAMP', { timestamp: Date.now() }, address, 0)

module.exports = { isolatorConfig }
