import { assert } from 'chai/index.mjs'
import { interchain, wrapReduce as hook } from '../../w002-api'
import { Dmz, RxRequest, Address, Request } from '../../w008-ipld'
import { actions } from '..'
import { spawnReducer, spawn } from '../src/spawn'
import { Engine } from '../../w210-engine'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:dmzReducer')
Debug.enable('*dmz* *hooks *engine* *callsites')

describe('dmzReducer', () => {
  test.todo('connect on existing is the same as move')
  test.todo('connect resolves an address without purging queued actions')
  test.todo('connect on existing unknown transmits all queued actions')
  test.todo('connect on operational channel empties the channel')
  describe('spawn', () => {
    jest.setTimeout(500)
    test.only('spawn is implicitly awaited', async () => {
      const reducer = async (state, action) => {
        debug(`reducer %o`, action)
        if (action.type === 'TEST_SPAWN') {
          await interchain(actions.spawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
        }
        return {}
      }
      const root = { reducer }
      const engine = await Engine.createCI()
      engine.overload({ root })
      engine.enableLogging()
      const request = Request.create({ type: 'TEST_SPAWN' })
      const result = await engine.pierce(request)
      debug(`result`, result)
      const state = engine.latest
      // state.getNetwork().dir()
      const channel = await state.getNetwork().getChild('child1')
      channel.dir()
      assert.strictEqual(requests.length, 2)
    })
    test('error if no spawn await', async () => {
      const reducer = async (state, action) => {
        debug(`reducer %o`, action)
        if (action.type === 'TEST_SPAWN') {
          interchain(actions.spawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
        }
        return {}
      }
      const root = { reducer }
      const engine = await Engine.createCI()
      engine.overload({ root })
      const request = Request.create({ type: 'TEST_SPAWN' })
      // TODO add reason test
      await expect(engine.pierce(request)).rejects.toThrow()
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
    test.todo('spawn moved to the tip of the channel')
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
