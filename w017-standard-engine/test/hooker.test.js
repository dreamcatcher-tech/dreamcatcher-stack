const assert = require('assert')
const debug = require('debug')('interblock:tests:continuation')
const { metrologyFactory } = require('../src/metrologyFactory')
const { blockModel } = require('../../w015-models')
require('../../w012-crypto').testMode()

require('debug').enable('*met* ')

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
})
