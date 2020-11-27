const assert = require('assert')
const debug = require('debug')('interblock:tests:hooker')
const { interchain } = require('../../w002-api')
const { actions } = require('../../w021-dmz-reducer')
const { metrologyFactory } = require('../src/metrologyFactory')
const { covenantIdModel, blockModel } = require('../../w015-models')
const covenants = require('../../w212-system-covenants')

require('debug').enable('*met* *tests* *hooks')

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
  })
  test.todo('throw if pending and tx a request to self')
  // if only request from pending is a request to self, then know it will never resolve
  // basically cannot raise pending, then request something to self
  test.todo('wait for all promises')
  test('self requests during pending can buffer', async () => {
    const reducer = async (state, action) => {
      debug(`reducer`, action)
      if (action.type === 'NONCE') {
        const pongPromise = interchain('PING')
        const children = await interchain(actions.listChildren())
        debug(`children: `, children)
      }
      return state
    }
    const hyper = { reducer }
    const base = await metrologyFactory('self', { hyper })
    base.enableLogging()
    await assert.doesNotReject(() => base.pierce({ type: 'NONCE' }))
    await base.settle()
  })
  test.todo('awaiting on self alone rejects')
})
