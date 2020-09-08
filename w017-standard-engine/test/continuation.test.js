const assert = require('assert')
const debug = require('debug')('interblock:tests:continuation')
const { metrologyFactory } = require('../src/metrologyFactory')
const { blockModel } = require('../../w015-models')
require('../../w012-crypto').testMode()

require('debug').enable('*metro* ')

describe('continuation', () => {
  describe('loopback', () => {
    test('loopback cleared immediately', async () => {
      const base = await metrologyFactory()
      base.enableLogging()
      await base.spawn('loop')
      const causeIncrease = await base.dispatch({
        type: 'PING',
        to: 'loop',
      })
      await base.settle()
      const block = base.getState()
      assert.equal(block.provenance.height, 2)
      const { requests, replies } = block.network['.']
      assert.equal(Object.keys(requests).length, Object.keys(replies).length)
    })
  })
})
