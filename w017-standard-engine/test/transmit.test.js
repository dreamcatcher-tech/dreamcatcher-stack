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

    assert.equal(base.getHeight(), 1)
    const child = await base.getChildren().child
    assert(!child.getPool().length)
    const basePool = base.getPool()
    const childChainId = child.getChainId()
    const isChainIdMatch = basePool.every(
      (interblock) => interblock.getChainId() === childChainId
    )
    assert(isChainIdMatch)
    assert(basePool.every(interblockModel.isModel))
    assert.equal(basePool.length, 3)
    const [birth, heavy, light] = basePool
    assert(!birth.getRemote())
    assert.equal(birth.provenance.height, 1)
    assert(heavy.getRemote())
    assert.equal(heavy.provenance.height, 2)
    assert(!light.getRemote())
    assert.equal(light.provenance.height, 2)
  })
})
