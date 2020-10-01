const assert = require('assert')
const debug = require('debug')('interblock:tests:increasor')
const { metrologyFactory } = require('../src/metrologyFactory')
const { blockModel } = require('../../w015-models')
const { shell } = require('../../w212-system-covenants')
const { request } = require('../../w002-api')
require('../../w012-crypto').testMode()

describe('increasor', () => {
  require('debug').enable('')
  test('no new block from lineage interblocks', async () => {
    const { covenantId } = shell // shell responds to pings
    const base = await metrologyFactory()
    await base.spawn('ping1', { covenantId })
    await base.spawn('ping2', { covenantId })

    await base.settle()
    const ping1 = await base.getChildren().ping1
    const ping2 = await base.getChildren().ping2
    assert.strictEqual(base.getHeight(), 2)
    assert.strictEqual(ping1.getHeight(), 2)
    assert.strictEqual(ping2.getHeight(), 2)

    base.dispatch(request('PING', {}, 'ping1'))
    require('debug').enable('*metrology* *tests:increasor')
    base.enableLogging()
    await base.settle()
    assert.strictEqual(base.getHeight(), 3)
    assert.strictEqual(ping1.getHeight(), 3)
    assert.strictEqual(ping2.getHeight(), 2)

    base.dispatch(request('PING', {}, 'ping2'))

    await base.settle()
    // boot, spawn1, resolve, spawn2, resolve, ping1, resolve, ping2, resolve
    assert.strictEqual(base.getHeight(), 4)
    assert.strictEqual(ping1.getHeight(), 3)
    assert.strictEqual(ping2.getHeight(), 3)

    // base pool check
    const basePool = base.getPool()
    assert.strictEqual(basePool.length, 2)
    assert(basePool.every(({ provenance }) => provenance.height === 3))
    assert(basePool.every((ib) => ib.getChainId() === ping2.getChainId()))
    const [heavy, light] = basePool
    assert(heavy.getRemote())
    assert(!light.getRemote())

    // ping2 pool check
    assert.strictEqual(ping2.getPool().length, 0)

    // ping1 pool check
    const ping1Pool = ping1.getPool()
    assert.strictEqual(ping1Pool.length, 1)
    const [parentLight] = ping1Pool
    assert(!parentLight.getRemote())
    assert.strictEqual(parentLight.getChainId(), base.getChainId())
  })
  test('no changes after isolation leaves block untouched', async () => {
    const base = await metrologyFactory()
    assert.strictEqual(base.getHeight(), 0)
    const { sqsIncrease } = base.getEngine()
    const address = base.getState().provenance.getAddress()
    sqsIncrease.push(address)
    await base.settle()
    assert.strictEqual(base.getHeight(), 0)
  })
  test('new channel causes lineage fork', async () => {
    const base = await metrologyFactory()
    await base.spawn('child1')
    await base.spawn('child2')
    await base.settle()
    assert.strictEqual(base.getHeight(), 2)
    const child2BirthBlock = await base.getChildren().child2.getState(1)
    const lineageParent = child2BirthBlock.network['..']
    assert.strictEqual(lineageParent.lineage.length, 1)

    const child2OperatingBlock = await base.getChildren().child2.getState(2)
    const fullParent = child2OperatingBlock.network['..']
    assert.strictEqual(fullParent.lineage.length, 2)
  })
  test('lineage and lineageTip is purged each new block', async () => {
    const base = await metrologyFactory()
    await base.spawn('child1')
    await base.spawn('child2')
    const child1Fresh = base.getState().network.child1
    assert.strictEqual(child1Fresh.heavyHeight, 2)
    assert.strictEqual(child1Fresh.lineageTip.length, 3)
    assert.strictEqual(child1Fresh.lineage.length, 3)

    await base.dispatch({ type: 'ping', to: 'child2' })
    const { child1 } = base.getState().network
    assert.strictEqual(child1.heavyHeight, 2)
    assert.strictEqual(child1.lineageTip.length, 1)
    assert.strictEqual(child1.lineage.length, 1)
    await base.settle()
  })
  test.todo('config changes cause new block')
  test.todo('rename alias does not cause interblock')
  test.todo('automatic promises')
  test.todo('tick with no response is an instant resolve')
  test.todo('resolving an alias causes lineage fork')
})
