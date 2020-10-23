const assert = require('assert')
const debug = require('debug')('interblock:tests:continuation')
const { metrologyFactory } = require('../src/metrologyFactory')
const { blockModel } = require('../../w015-models')
require('../../w012-crypto').testMode()

require('debug').enable('*metro* ')

describe('continuation', () => {
  test('loopback cleared immediately', async () => {
    const base = await metrologyFactory()
    base.enableLogging()
    await base.spawn('loop')
    await base.pierce({
      type: 'PING',
      to: 'loop',
    })
    await base.settle()
    const block = base.getState()
    assert.strictEqual(block.provenance.height, 3)
    const { requests, replies } = block.network['.']
    const length = (obj) => Object.keys(obj).length
    assert.strictEqual(length(requests), length(replies))
  })
})
