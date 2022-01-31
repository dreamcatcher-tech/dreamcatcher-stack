import assert from 'assert-fast'
import { _hook as hook } from '../../../../w002-api'
import { Block, RxReply, RxRequest, State } from '../../../../w015-models'
import * as systemCovenants from '../../../../w212-system-covenants'
import * as appCovenants from '../../../../w301-user-apps'
import { queryFactory } from '../queryFactory'
import Debug from 'debug'
const debug = Debug('interblock:isolate')
// TODO move to making own containers, so can keep promises alive
// TODO set timestamp in container by overriding Date.now()
// TODO move to having ramIsolate be the default, but allow other hardware based isolations
// like containers, iFrames, cluster, and vm2 - same as dynamodb and ramDb
const baseState = State.create()
const ramIsolate = (ioConsistency, preloadedCovenants = {}) => {
  assert.strictEqual(typeof preloadedCovenants, 'object')
  const containers = {}
  const covenants = _mergeCovenants(preloadedCovenants)
  return {
    loadCovenant: async (block) => {
      assert(block instanceof Block)
      const { covenantId } = block
      const containerId = block.provenance.reflectIntegrity().hash
      const { name } = covenantId
      assert(covenants[name], `No covenant loaded: ${name}`)
      // TODO reuse prior containers, and update the block each time

      debug(`loadCovenant %o from %o`, name, Object.keys(covenants))
      debug(`containerId: %o`, containerId.substring(0, 9))
      await Promise.resolve()
      let covenant = covenants[name]
      containers[containerId] = { covenant, block, effects: [] }
      return containerId
    },
    // TODO unload covenant when finished
    // TODO intercept timestamp action and overwrite Date.now()
    // TODO make accumulator be a model
    tick: async ({ containerId, timeout, state, action, accumulator }) => {
      debug(`tick: %o action: %o`, containerId.substring(0, 9), action.type)
      state = state || baseState
      const container = containers[containerId]
      assert(container, `No tick container for: ${containerId}`)
      assert(state instanceof State)
      assert(Array.isArray(accumulator))
      timeout = timeout || 30000
      assert(Number.isInteger(timeout) && timeout >= 0)
      assert(action instanceof RxReply || action instanceof RxRequest)

      // TODO test rejections propogate back thru queues
      // TODO move to a pure container wrapper, then to vm2 or similar
      let { reducer } = container.covenant
      if (!reducer) {
        // TODO check that this is a multicovenant covenant
        assert(container.covenant.covenants)
        reducer = (state) => state
      }
      const tick = () => {
        return reducer(state.getState(), action.toJS())
      }
      const queryProcessor = queryFactory(ioConsistency, container.block)
      const queries = (query) => queryProcessor.query(query)
      const result = await hook(tick, accumulator, queries)
      queryProcessor.disable()
      debug(`result`, result)

      const { reduction, isPending, transmissions } = result
      assert((reduction && !isPending) || (!reduction && isPending))
      assert.strictEqual(typeof isPending, 'boolean')
      assert(Array.isArray(transmissions))
      if (isPending) {
        // TODO reconcile to ensure something awaitable is still happening
        assert(accumulator.length || transmissions.length)
      }

      const effectedActions = transmissions.map((tx) => {
        const { to } = tx
        if (to === '.@@io') {
          // TODO map effects to ids, so can be invoked by queue
          assert.strictEqual(typeof tx.exec, 'function')
          let { type, payload, to } = tx
          payload = { ...payload, '@@effectId': container.effects.length }
          container.effects.push(tx)
          return { type, payload, to }
        }
        return tx
      })
      return { reduction, isPending, transmissions: effectedActions }
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
    getCovenants: () => covenants,
  }
}

const isolateFactory = (ioConsistency, preloadedCovenants) => {
  const isolation = ramIsolate(ioConsistency, preloadedCovenants)
  const reducer = (action) => {
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
  // TODO remove this function
  reducer._getCovenants = () => isolation.getCovenants()
  return reducer
}

const toFunctions = (queue) => ({
  loadCovenant: (payload) => queue.push({ type: 'LOAD_COVENANT', payload }),
  tick: (payload) => queue.push({ type: 'TICK', payload }),
  unloadCovenant: (payload) => queue.push({ type: 'UNLOAD_COVENANT', payload }),
  executeEffect: (payload) => queue.push({ type: 'EXECUTE', payload }),
})
const _mergeCovenants = (preloadedCovenants) => {
  const covenants = {
    ...systemCovenants,
    ...appCovenants,
    ...preloadedCovenants,
  }
  for (const name in preloadedCovenants) {
    const covenant = preloadedCovenants[name]
    if (covenant.covenants) {
      // TODO handle arbitrary deep nesting by walking root
      Object.assign(covenants, covenant.covenants)
    }
  }
  return covenants
}
export { isolateFactory, toFunctions }
