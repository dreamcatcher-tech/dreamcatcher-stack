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

    assert.strictEqual(base.getHeight(), 1)
    const child = await base.getChildren().child
    assert(!child.getPool().length)
    const basePool = base.getPool()
    const childChainId = child.getChainId()
    const isChainIdMatch = basePool.every(
      (interblock) => interblock.getChainId() === childChainId
    )
    assert(isChainIdMatch)
    assert(basePool.every(interblockModel.isModel))
    assert.strictEqual(basePool.length, 3)
    const [birth, heavy, light] = basePool
    assert(!birth.getRemote())
    assert.strictEqual(birth.provenance.height, 1)
    assert(heavy.getRemote())
    assert.strictEqual(heavy.provenance.height, 2)
    assert(!light.getRemote())
    assert.strictEqual(light.provenance.height, 2)
  })
})
