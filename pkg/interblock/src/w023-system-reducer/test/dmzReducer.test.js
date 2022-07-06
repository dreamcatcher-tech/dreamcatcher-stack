import { assert } from 'chai/index.mjs'
import { interchain } from '../../w002-api'
import { Request } from '../../w008-ipld'
import { actions } from '..'
import { Engine } from '../../w210-engine'
import Debug from 'debug'
const debug = Debug('interblock:tests:dmzReducer')
// Debug.enable('*dmz* *hooks *engine* *callsites')

describe('dmzReducer', () => {
  describe('spawn', () => {
    test('spawn is implicitly awaited', async () => {
      const reducer = async (request) => {
        debug(`reducer %o`, request)
        if (request.type === 'TEST_SPAWN') {
          await interchain(actions.spawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
          return { test: true }
        }
      }
      const root = { reducer }
      const engine = await Engine.createCI()
      engine.overload({ root })
      engine.enableLogging()
      const request = Request.create({ type: 'TEST_SPAWN' })
      // 5 blocks 103ms, 3 blocks 79ms = 20ms / block
      const result = await engine.pierce(request)
      debug(`result`, result)
      const state = engine.latest
      const channel = await state.getNetwork().getChild('child1')
      expect(channel).toMatchSnapshot()
    })
    test('error if no spawn await', async () => {
      // TODO make this error clearer somehow
      const reducer = async (request) => {
        debug(`reducer %o`, request)
        if (request.type === 'TEST_SPAWN') {
          interchain(actions.spawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
        }
      }
      const root = { reducer }
      const engine = await Engine.createCI()
      engine.overload({ root })
      const request = Request.create({ type: 'TEST_SPAWN' })
      const msg = 'path must be foreign'
      await expect(engine.pierce(request)).rejects.toThrow(msg)
    })
    test.todo('spawn uses hash for seeding inside action')
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
