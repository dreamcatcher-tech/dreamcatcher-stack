const assert = require('assert')
const debug = require('debug')('interblock:tests:pool')
const { metrologyFactory } = require('../src/metrologyFactory')
const { interblockModel } = require('../../w015-models')
require('../../w012-crypto').testMode()

describe('transmit', () => {
  require('debug').enable('*metrology* *tests:pool')
  test('base has pooled lineage except genesis', async () => {
    const base = await metrologyFactory()

    base.spawn('child')
    await base.settle()

    assert.strictEqual(base.getHeight(), 2)
    const { child } = base.getChildren()
    assert.strictEqual(child.getPool().length, 1)
    const childPool = child.getPool()
    const isChainIdMatch = childPool.every(
      (interblock) => interblock.getChainId() === base.getChainId()
    )
    assert(isChainIdMatch)
    assert(childPool.every(interblockModel.isModel))
    assert.strictEqual(childPool.length, 1)
    // TODO use a remote chain to avoid io causing blockmaking
  })
})
