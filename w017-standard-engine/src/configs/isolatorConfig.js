const assert = require('assert')
const debug = require('debug')('interblock:config:isolator')
const { assign } = require('xstate')
const { rxRequestModel, dmzModel, lockModel } = require('../../../w015-models')
const { networkProducer } = require('../../../w016-producers')
const { openPaths } = require('../../../w021-dmz-reducer')
const { thread } = require('../execution/thread')
const { interpreterConfig } = require('./interpreterConfig')
const { machine } = require('../machines/isolator')
const isolationProcessor = require('../services/isolateFactory')

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
    assignHasPierced: assign({ hasPierced: () => true }),
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
    isDmzChangeable: ({ dmz }) => {
      // incoming changes detected
      assert(dmzModel.isModel(dmz))
      const { isPierced } = dmz.config
      const rx = dmz.network.rx()
      const isDmzChangeable = isPierced || rx
      debug(`isDmzChangeable: ${isDmzChangeable}`)
      return isDmzChangeable
    },
    isPiercable: ({ dmz, hasPierced }) => {
      assert(dmzModel.isModel(dmz))
      const isExhausted = !dmz.network.rx()
      const { isPierced } = dmz.config
      const isPiercable = isExhausted && isPierced && !hasPierced
      debug(`isPiercable: %O`, isPiercable)
      return isPiercable
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
    loadCovenant: async ({ lock, isolation }) => {
      assert(lockModel.isModel(lock))
      const containerId = await isolation.loadCovenant(lock.block)
      debug(`loadCovenant containerId: ${containerId.substring(0, 9)}`)
      return { containerId }
    },
    reduceActionless: async ({ dmz, containerId, isolation }) => {
      debug(`reduceActionless`)
      assert(dmzModel.isModel(dmz))
      const address = dmz.network['.'].address
      const anvil = createTimestampAnvil(address)
      const tick = createTick(containerId, isolation.tick)
      const interpreter = interpreterConfig(tick, dmz, anvil, address)
      const nextDmz = await thread('TICK', interpreter)
      assert(dmzModel.isModel(nextDmz))
      return { nextDmz }
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
    unloadCovenant: async ({ containerId, isolation }) => {
      debug(`unloadCovenant containerId: %o`, containerId.substring(0, 9))
      await isolation.unloadCovenant(containerId)
    },
  },
})

const isolatorConfig = (ioIsolate) => {
  const isolation = isolationProcessor.toFunctions(ioIsolate)
  return isolatorMachine.withContext({ isolation })
}

const createTick = (containerId, tick) => (state, action) =>
  tick({ containerId, state, action })
const createTimestampAnvil = (address) =>
  rxRequestModel.create('@@PIERCE', { timestamp: Date.now() }, address, 0)

module.exports = { isolatorConfig }
