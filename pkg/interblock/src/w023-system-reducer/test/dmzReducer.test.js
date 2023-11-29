import { assert } from 'chai/index.mjs'
import { interchain, useState } from '../../w002-api'
import { Request } from '../../w008-ipld'
import { Engine } from '../../w210-engine'
import { Interpulse } from '../../w310-interpulse'
import Debug from 'debug'
const debug = Debug('interblock:tests:dmzReducer')

describe('dmzReducer', () => {
  describe('spawn', () => {
    test('spawn is implicitly awaited', async () => {
      const reducer = async (request) => {
        debug(`reducer %o`, request)
        if (request.type === 'TEST_SPAWN') {
          await interchain(Request.createSpawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
          return { test: true }
        }
      }
      const root = { reducer }
      const engine = await Engine.createCI()
      engine.overload({ root })
      const request = Request.create({ type: 'TEST_SPAWN' })
      // 5 blocks 103ms, 3 blocks 79ms = 20ms / block
      const result = await engine.pierce(request)
      debug(`result`, result)
      const state = engine.selfLatest
      const channel = await state.getNetwork().getChild('child1')
      expect(channel).toMatchSnapshot()
    })
    test('error if no spawn await', async () => {
      // TODO make this error clearer somehow
      const reducer = async (request) => {
        debug(`reducer %o`, request)
        if (request.type === 'TEST_SPAWN') {
          interchain(Request.createSpawn('child1'))
          const result = await interchain('PING', { test: 'ping' }, 'child1')
          debug(`result`, result)
        }
      }
      const root = { reducer }
      const engine = await Engine.createCI()
      engine.overload({ root })
      const request = Request.create({ type: 'TEST_SPAWN' })
      const msg = 'path must be foreign: child1'
      assert.strictEqual(engine.logger.pulseCount, 1)
      await expect(engine.pierce(request)).rejects.toThrow(msg)
    })
    test('system ping', async () => {
      const engine = await Engine.createCI()
      const result = await engine.pierce(Request.createPing('test'))
      assert.deepEqual(result, { string: 'test' })
    })
    test.todo('spawn uses hash for seeding inside action')
  })
  describe('openPaths', () => {
    test.todo('cannot be more than one outstanding @@OPEN request in a channel')
    test.todo('missing parents with open children skips straight to children')
    test.todo('3 levels deep')
    test.todo('random path opening and closing and reopening')
    test.todo('simultaneous requests with common parent')
    test.todo('open between two siblings using ../sibling')
  })
  describe('uplink', () => {
    test.todo('multiple requests from same chain result in single uplink')
  })
  describe('connect', () => {
    test.todo('connect on existing is the same as move')
    test.todo('connect resolves an address without purging queued actions')
    test.todo('connect on existing unknown transmits all queued actions')
    test.todo('connect on operational channel throws')
  })
  describe('useState', () => {
    test('remote useState', async () => {
      const engine = await Interpulse.createCI({
        overloads: {
          '/test': {
            reducer: async (request) => {
              if (request.type === '@@INIT') {
                return
              }
              const [state, setState] = await useState('target')
              expect(state).toEqual({ foo: 'bar' })
              await setState({ foo: 'baz' })
              const [nextState] = await useState('target')
              expect(nextState).toEqual({ foo: 'baz' })
            },
          },
        },
      })
      await engine.add('agent', '/test')
      await engine.add('agent/target', { state: { foo: 'bar' } })
      const remote = await engine.current('agent/target')
      const state = remote.getState().toJS()
      expect(state).toEqual({ foo: 'bar' })
      await engine.dispatch({ type: 'BEGIN', payload: {} }, 'agent')
      const nextRemote = await engine.current('agent/target')
      const nextState = nextRemote.getState().toJS()
      expect(nextState).toEqual({ foo: 'baz' })
    })
  })
})
