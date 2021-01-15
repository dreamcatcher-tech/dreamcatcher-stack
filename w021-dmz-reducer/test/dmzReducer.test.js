const assert = require('assert')
const debug = require('debug')('interblock:tests:dmzReducer')
const { interchain } = require('../../w002-api')
const {
  dmzModel,
  actionModel,
  addressModel,
  stateModel,
  covenantIdModel,
} = require('../../w015-models')
const { networkProducer } = require('../../w016-producers')
const { actions } = require('..')
const { metrologyFactory } = require('../../w017-standard-engine')
require('debug').enable('*met* *tests*')

describe('dmzReducer', () => {
  test.todo('connect on existing is the same as move')
  test.todo('connect resolves an address without purging queued actions')
  test.todo('connect on existing unknown transmits all queued actions')
  test.todo('connect on operational channel empties the channel')
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
