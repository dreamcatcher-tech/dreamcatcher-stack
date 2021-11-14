import { assert } from 'chai/index.mjs'
import { interchain, replyResolve } from '../../w002-api'
import { actions } from '../../w017-dmz-producer'
import { metrologyFactory } from '../src/metrologyFactory'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:hooker')

describe('hooker', () => {
  test('loopback cleared immediately', async () => {
    const base = await metrologyFactory()
    base.enableLogging()
    await base.spawn('loop')
    const pong = await base.pierce('PING')
    assert.strictEqual(pong.type, 'PONG')
    await base.settle()
    const block = base.getState()
    assert.strictEqual(block.provenance.height, 3)
    const { requests, replies } = block.network['.']
    const length = (obj) => Object.keys(obj).length
    assert.strictEqual(length(requests), length(replies))
    assert.strictEqual(length(requests), 0)
  })
  test.todo('throw if pending and tx a request to self')
  // if only request from pending is a request to self, then know it will never resolve
  // basically cannot raise pending, then request something to self
  test.todo('wait for all promises')
  test('self requests during pending can buffer', async () => {
    const reducer = async (state, action) => {
      debug(`reducer`, action)
      if (action.type === 'NONCE') {
        interchain('PING')
        const awaitedPing = await interchain(actions.ping('test'))
        debug(`awaitedPing: `, awaitedPing)
        replyResolve(awaitedPing)
      }
      return state
    }
    const hyper = { reducer }
    const base = await metrologyFactory('self', { hyper })
    base.enableLogging()
    const isNotRejected = await base.pierce({ type: 'NONCE' })
    assert.deepEqual(isNotRejected, { string: 'test' })
    await base.settle()
  })
  test.todo('awaiting on self alone rejects')
  // set up a reducer that gets tampered with after promise resolves
  test.todo('covenant must make requests in same order')
})
