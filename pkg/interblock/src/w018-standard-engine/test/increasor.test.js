import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '../src/metrologyFactory'
import { shell } from '../../w212-system-covenants'
import Debug from 'debug'
const debug = Debug('interblock:tests:increasor')
Debug.enable()

describe('increasor', () => {
  test('pools always empty after blocking', async () => {
    const { covenantId } = shell // shell responds to pings
    const base = await metrologyFactory('inc', { hyper: shell })
    await base.spawn('ping1', { covenantId })
    await base.spawn('ping2', { covenantId })

    await base.settle()
    const ping1 = await base.getChildren().ping1
    const ping2 = await base.getChildren().ping2
    assert.strictEqual(base.getHeight(), 4)
    assert.strictEqual(ping1.getHeight(), 1)
    assert.strictEqual(ping2.getHeight(), 1)

    base.pierce(shell.actions.ping('ping1'))
    await base.settle()
    assert.strictEqual(base.getHeight(), 6)
    assert.strictEqual(ping1.getHeight(), 2)
    assert.strictEqual(ping2.getHeight(), 1)

    base.pierce(shell.actions.ping('ping2'))

    await base.settle()
    // boot, spawn1, resolve, spawn2, resolve, ping1, resolve, ping2, resolve
    assert.strictEqual(base.getHeight(), 8)
    assert.strictEqual(ping1.getHeight(), 2)
    assert.strictEqual(ping2.getHeight(), 2)

    // base pool check
    const basePool = base.getPool()
    assert.strictEqual(basePool.length, 0)

    // ping2 pool check
    assert.strictEqual(ping2.getPool().length, 0)

    // ping1 pool check
    const ping1Pool = ping1.getPool()
    assert.strictEqual(ping1Pool.length, 0)
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
    assert.strictEqual(base.getHeight(), 4)
    const { provenance } = base.getState()
    assert.strictEqual(Object.keys(provenance.lineage).length, 2)
  })
  test.todo('config changes cause new block')
  test.todo('rename alias does not cause interblock')
  test.todo('automatic promises')
  test.todo('tick with no response is an instant resolve')
  test.todo('resolving an alias causes lineage fork')
  test.todo('reject if piercings for unpierced reducer')
  test.todo('triangular test for large numbers of pooled lineage')
})
