const assert = require('assert')
const debug = require('debug')('interblock:tests:dmzReducer')
const { interchain, '@@GLOBAL_HOOK_INBAND': hook } = require('../../w002-api')
const {
  dmzModel,
  rxRequestModel,
  actionModel,
  addressModel,
  stateModel,
  covenantIdModel,
} = require('../../w015-models')
const { networkProducer } = require('../../w016-producers')
const { actions } = require('..')
const { metrologyFactory } = require('../../w017-standard-engine')
const { spawnReducer, spawn } = require('../src/spawn')
require('debug').enable('*met* *tests* *dmz:spawn *provenance')

describe('dmzReducer', () => {
  test.todo('connect on existing is the same as move')
  test.todo('connect resolves an address without purging queued actions')
  test.todo('connect on existing unknown transmits all queued actions')
  test.todo('connect on operational channel empties the channel')
  describe('spawn', () => {
    test('spawn is implicitly awaited', async () => {
      const reducer = async (state, action) => {
        debug(`reducer`, action)
        if (action.type === 'SPAWN') {
          interchain(actions.spawn('child1'))
          await interchain('PING', {}, 'child1')
        }
        return {}
      }
      const covenantId = covenantIdModel.create('hyper')
      const hyper = { reducer, covenantId }
      const base = await metrologyFactory('multi', { hyper })
      base.enableLogging()
      await base.pierce({ type: 'SPAWN' })
      await base.settle()
      const state = base.getState(1)
      const requests = state.network.child1.getRequestIndices()
      assert.strictEqual(requests.length, 2)
    })
    test.only('spawn uses hash inside action', async () => {
      debugger
      const dmz = dmzModel.create()
      const { type, payload } = spawn('hashTest')
      const address = addressModel.create('LOOPBACK')
      const request = rxRequestModel.create(type, payload, address, 0)
      const tick = () => {
        const result = spawnReducer(dmz, request)
        return result
      }
      const start = Date.now()
      const nextNetwork = await hook(tick)
      debug('elapsed time', Date.now() - start)

      const action = nextNetwork.reduction.hashTest.requests[0]
      debug(action)
      const hash = action.getHash()
      debug(hash)
      debugger
      // assert(elapsed < 20)
    })
  })
  describe('openPaths', () => {
    test.todo('missing parents with open children skips straight to children')
    test.todo('cannot be more than one outstanding @@OPEN request in a channel')
    test.todo('3 levels deep')
    test.todo('random path opening and closing and reopening')
    test.todo('simultaneous requests with common parent')
  })
  describe('uplink', () => {
    test.todo('multiple requests from same chain result in single uplink')
  })
})
