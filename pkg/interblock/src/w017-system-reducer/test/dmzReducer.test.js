import { assert } from 'chai/index.mjs'
import { interchain, _hook as hook } from '../../w002-api'
import { Dmz, RxRequest, Address, CovenantId } from '../../w015-models'
import { actions } from '..'
import { metrologyFactory } from '../../w018-standard-engine'
import { spawnReducer, spawn } from '../src/spawn'
import { jest } from '@jest/globals'
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
        debug(`reducer %o`, action)
        if (action.type === 'TEST_SPAWN') {
          interchain(actions.spawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
        }
        return {}
      }
      const covenantId = CovenantId.create('hyper')
      const hyper = { reducer, covenantId }
      const base = await metrologyFactory('multi', { hyper })
      base.enableLogging()
      await base.pierce({ type: 'TEST_SPAWN' })
      await base.settle()
      const state = await base.getBlock(1)
      const requests = state.network.get('child1').requests
      assert.strictEqual(requests.length, 2)
    })
    test('spawn uses hash for seeding inside action', async () => {
      const dmz = Dmz.create()
      const { type, payload } = spawn('hashTest')
      const address = Address.create('LOOPBACK')
      const request = RxRequest.create(type, payload, address, 0, 0)
      const tick = () => {
        const result = spawnReducer(dmz, request)
        return result
      }
      const result = await hook(tick)

      const action = result.reduction.network.get('hashTest').requests[0]
      const hash = action.hashString()
      // TODO hard to test if the actual path used genesis other than stepping
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
