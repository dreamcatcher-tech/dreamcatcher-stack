const assert = require('assert')
const { '@@GLOBAL_HOOK': hook } = require('../../../w002-api')
const {
  blockModel,
  rxReplyModel,
  rxRequestModel,
} = require('../../../w015-models')
const systemCovenants = require('../../../w212-system-covenants')
const appCovenants = require('../../../w301-user-apps')
const debug = require('debug')('interblock:isolate')
// TODO move to making own containers, so can keep promises alive
// TODO set timestamp in container by overriding Date.now()
// TODO move to having ramIsolate be the default, but allow other hardware based isolations
// like containers, iFrames, cluster, and vm2 - same as dynamodb and ramDb

const ramIsolate = (ioConsistency, preloadedCovenants = {}) => {
  const containers = {}
  const covenants = {
    ...systemCovenants,
    ...appCovenants,
    ...preloadedCovenants,
  }
  return {
    loadCovenant: async (block) => {
      assert(blockModel.isModel(block))
      const { covenantId } = block
      const containerId = block.provenance.reflectIntegrity().hash
      const { name } = covenantId
      assert(covenants[name], `No covenant loaded: ${name}`)
      // TODO reuse prior containers, and update the block each time

      debug(`loadCovenant %o from %o`, name, Object.keys(covenants))
      debug(`containerId: %o`, containerId.substring(0, 9))
      await Promise.resolve()
      const covenant = covenants[name]
      containers[containerId] = { covenant, block, effects: {} }
      return containerId
    },
    // TODO unload covenant when finished
    // TODO intercept timestamp action and overwrite Date.now()
    tick: async ({ containerId, state, action, accumulator = [], timeout }) => {
      debug(`tick: %o action: %o`, containerId.substring(0, 9), action.type)
      const container = containers[containerId]
      assert(container, `No tick container for: ${containerId}`)
      assert(!state || typeof state === 'object') // TODO allow anything as state
      assert(Array.isArray(accumulator))
      timeout = timeout || 30000
      assert(Number.isInteger(timeout) && timeout >= 0)
      if (rxReplyModel.isModel(action)) {
        assert(!accumulator.length)
      } else {
        assert(rxRequestModel.isModel(action))
      }

      // TODO test rejections propogate back thru queues
      // TODO move to a pure container wrapper, then to vm2 or similar
      const tick = () => container.covenant.reducer(state, action)
      // TODO remove need for salt by relaxing duplicate check in channel
      const salt = action.getHash() // TODO ensure reply actions salt uniquely

      // ### provide a callback to run queries on
      const queries = (query) => {
        debug(`query: `, query)
        // ### do block walking when the path is nested
        // check if query is enabled whenever one is received
        // enable only during hook execution
      }
      const result = await hook(tick, accumulator, salt, queries)
      debug(`result`, result)

      const { reduction, isPending, requests, replies } = result
      assert((reduction && !isPending) || (!reduction && isPending))
      assert.strictEqual(typeof isPending, 'boolean')
      assert(Array.isArray(requests))
      assert(Array.isArray(replies))
      if (isPending) {
        assert(accumulator.length || requests.length)
      }

      const mappedActions = requests.map((action) => {
        const { to } = action
        if (to === '.@@io') {
          // TODO map effects to ids, so can be invoked by queue
          assert.strictEqual(typeof action.exec, 'function')
          const requestId = action.payload['.@@ioRequestId']
          assert.strictEqual(typeof requestId, 'string')
          assert(requestId.length > salt.length + 1)
          assert(!container.effects[requestId])
          container.effects[requestId] = action
          const { type, payload, to } = action
          return { type, payload, to }
        }
        return action
      })
      return { reduction, isPending, requests: mappedActions, replies }
    },
    unloadCovenant: async (containerId) => {
      debug(`attempting to unload: %o`, containerId)
      await Promise.resolve()
      assert(containers[containerId], `No container for: ${containerId}`)
      // TODO keep containers, in a frozen state, ready for reuse
      delete containers[containerId]
    },
    setEffectPermissions: async ({ containerId, permissions }) => {
      // toggles the default mode of complete block level isolation
      // used to allow hardware access during blocktime
      // but more commonly to allow effects to have access to network
      // TODO allow this to be set per effect
    },
    executeEffect: async ({ containerId, effectId, timeout }) => {
      // executes and awaits the result of a previously returned promise
      debug(`executeEffect effectId: %o`, effectId)
      const container = containers[containerId]
      assert(container, `No effects container for: ${containerId}`)
      assert(container.effects[effectId], `No effect for: ${effectId}`)
      const action = container.effects[effectId]
      debug(`action: `, action)
      assert.strictEqual(typeof action.exec, 'function')
      const result = await action.exec()
      return result
    },
  }
}

const isolateFactory = (ioConsistency, preloadedCovenants) => {
  const isolation = ramIsolate(ioConsistency, preloadedCovenants)
  return (action) => {
    switch (action.type) {
      case 'LOAD_COVENANT':
        return isolation.loadCovenant(action.payload)
      case 'TICK':
        return isolation.tick(action.payload)
      case 'UNLOAD_COVENANT':
        return isolation.unloadCovenant(action.payload)
      case 'EXECUTE':
        return isolation.executeEffect(action.payload)
      default:
        throw new Error(`Unknown isolator action type`)
    }
  }
}

const toFunctions = (queue) => ({
  loadCovenant: (payload) => queue.push({ type: 'LOAD_COVENANT', payload }),
  tick: (payload) => queue.push({ type: 'TICK', payload }),
  unloadCovenant: (payload) => queue.push({ type: 'UNLOAD_COVENANT', payload }),
  executeEffect: (payload) => queue.push({ type: 'EXECUTE', payload }),
})

module.exports = { isolateFactory, toFunctions }
