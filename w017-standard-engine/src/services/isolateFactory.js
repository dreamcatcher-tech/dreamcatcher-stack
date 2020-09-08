const truncate = require('cli-truncate')
const assert = require('assert')
const { blockModel } = require('../../../w015-models')
const systemCovenants = require('../../../w212-system-covenants')
const debug = require('debug')('interblock:isolate')
// TODO move to making own containers, so can keep promises alive
// TODO set timestamp in container by overriding Date.now()

const ramIsolate = (preloadedCovenants) => {
  const containers = {}
  const covenants = { ...systemCovenants, ...preloadedCovenants }
  return {
    loadCovenant: async (block) => {
      assert(blockModel.isModel(block))
      const { covenantId } = block
      const containerId = block.provenance.reflectIntegrity().hash
      const { name } = covenantId
      assert(covenants[name], `No covenant loaded: ${name}`)

      debug(`loadCovenant %o from %o`, name, Object.keys(covenants))
      debug(`containerId: %o`, truncate(containerId, 9))
      containers[containerId] = { covenant: covenants[name], block }
      return containerId
    },
    // TODO unload covenant when finished
    // TODO intercept timestamp action and overwrite Date.now()
    tick: async ({ containerId, state, action }) => {
      debug(`tick: %o action: %o`, containerId.substring(0, 9), action.type)
      const container = containers[containerId]
      assert(container, `No tick container for: ${containerId}`)
      const nextState = await container.covenant.reducer(state, action)
      return nextState
    },
    unloadCovenant: async (containerId) => {
      debug(`attempting to unload: %o`, containerId)
      await Promise.resolve()
      assert(containers[containerId], `No container for: ${containerId}`)
      delete containers[containerId]
    },
  }
}

const isolateFactory = (preloadedCovenants) => {
  const isolation = ramIsolate(preloadedCovenants)
  return (action) => {
    switch (action.type) {
      case 'LOAD_COVENANT':
        return isolation.loadCovenant(action.payload)
      case 'TICK':
        return isolation.tick(action.payload)
      case 'UNLOAD_COVENANT':
        return isolation.unloadCovenant(action.payload)
      default:
        throw new Error(`Unknown isolator action type`)
    }
  }
}

const toFunctions = (queue) => ({
  loadCovenant: (payload) => queue.push({ type: 'LOAD_COVENANT', payload }),
  tick: (payload) => queue.push({ type: 'TICK', payload }),
  unloadCovenant: (payload) => queue.push({ type: 'UNLOAD_COVENANT', payload }),
})

module.exports = { isolateFactory, toFunctions }
