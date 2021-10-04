import { assert } from 'chai/index.mjs'
import { interchain, _hook as hook } from '../../w002-api'
import {
  dmzModel,
  rxRequestModel,
  actionModel,
  blockModel,
  addressModel,
  stateModel,
  covenantIdModel,
} from '../../w015-models'
import { actions } from '..'
import { metrologyFactory } from '../../w018-standard-engine'
import { spawnReducer, spawn } from '../src/spawn'
import Debug from 'debug'
const debug = Debug('interblock:tests:dmzReducer')
Debug.enable()

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
    test('spawn uses hash inside action', async () => {
      const dmz = dmzModel.create()
      const { type, payload } = spawn('hashTest')
      const address = addressModel.create('LOOPBACK')
      const request = rxRequestModel.create(type, payload, address, 0)
      const tick = () => {
        const result = spawnReducer(dmz, request)
        return result
      }
      const nextNetwork = await hook(tick)

      const action = nextNetwork.reduction.hashTest.requests[0]
      const hash = action.getHash()
      // hard to test if the actual path used genesis other than stepping
    })
  })
  describe('openPaths', () => {
    test.todo('cannot be more than one outstanding @@OPEN request in a channel')
    test.todo('missing parents with open children skips straight to children')
    test.todo('3 levels deep')
    test.todo('random path opening and closing and reopening')
    test.todo('simultaneous requests with common parent')
  })
  describe('uplink', () => {
    test.todo('multiple requests from same chain result in single uplink')
  })
})
