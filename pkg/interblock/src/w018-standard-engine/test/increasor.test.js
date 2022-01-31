import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '..'
import { shell } from '../../w212-system-covenants'
import { dbFactory } from '../src/services/consistencyFactory'
import { rxdbmem } from '../src/services/rxdbMem'
import { Cache } from '../src/services/consistencyFactory/dbFactory'
import { ciKeypair } from '../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:tests:increasor')
Debug.enable()

describe('increasor', () => {
  test.only('single child chain', async () => {
    const base = await metrologyFactory()
    await base.spawn('child1')
    await base.shutdown()
  })
  test('single child chain no cache', async () => {
    Cache.disable()
    const base = await metrologyFactory()
    await base.spawn('child1')
    await base.shutdown()
  })
  test('pools always empty after blocking', async () => {
    const { covenantId } = shell // shell responds to pings
    const rxdb = rxdbmem('increasor')
    const base = await metrologyFactory('inc', { hyper: shell }, rxdb)
    await base.spawn('ping1', { covenantId })
    await base.spawn('ping2', { covenantId })

    await base.settle()
    let baseBlock = await base.getLatest()
    let ping1 = await base.getLatestFromPath('/ping1')
    let ping2 = await base.getLatestFromPath('/ping2')
    assert.strictEqual(baseBlock.getHeight(), 4)
    assert.strictEqual(ping1.getHeight(), 1)
    assert.strictEqual(ping2.getHeight(), 1)

    base.pierce(shell.actions.ping('ping1'))
    await base.settle()
    baseBlock = await base.getLatest()
    ping1 = await base.getLatestFromPath('/ping1')
    ping2 = await base.getLatestFromPath('/ping2')
    assert.strictEqual(baseBlock.getHeight(), 6)
    assert.strictEqual(ping1.getHeight(), 2)
    assert.strictEqual(ping2.getHeight(), 1)

    base.pierce(shell.actions.ping('ping2'))

    await base.settle()
    // boot, spawn1, resolve, spawn2, resolve, ping1, resolve, ping2, resolve
    baseBlock = await base.getLatest()
    ping1 = await base.getLatestFromPath('/ping1')
    ping2 = await base.getLatestFromPath('/ping2')
    assert.strictEqual(baseBlock.getHeight(), 8)
    assert.strictEqual(ping1.getHeight(), 2)
    assert.strictEqual(ping2.getHeight(), 2)

    // base pool check
    const db = dbFactory(rxdb) // avoids the cache
    const c = await db.getBlock(baseBlock.getChainId(), baseBlock.getHeight())
    baseBlock.deepEquals(c)
    assert(baseBlock.deepEquals(c), `database is not live`)
    const basePool = await db.queryPool(baseBlock.getChainId())
    assert.strictEqual(basePool.length, 0)

    // ping1 pool check
    const ping1Pool = await db.queryPool(ping1.getChainId())
    assert.strictEqual(ping1Pool.length, 0)

    // ping2 pool check
    const ping2Pool = await db.queryPool(ping2.getChainId())
    assert.strictEqual(ping2Pool.length, 0)
    await base.shutdown()
  })
  test('no changes after isolation leaves block untouched', async () => {
    const base = await metrologyFactory()
    let baseBlock = await base.getLatest()
    assert.strictEqual(baseBlock.getHeight(), 0)
    const { sqsIncrease } = base.getEngine()
    const address = baseBlock.provenance.getAddress()
    sqsIncrease.push(address)
    await base.settle()
    baseBlock = await base.getLatest()
    assert.strictEqual(baseBlock.getHeight(), 0)
    await base.shutdown()
  })
  test('new channel causes lineage fork', async () => {
    const base = await metrologyFactory()
    await base.spawn('child1')
    await base.spawn('child2')
    await base.settle()
    const baseBlock = await base.getLatest()
    assert.strictEqual(baseBlock.getHeight(), 4)
    const { provenance } = baseBlock
    assert.strictEqual(provenance.lineage.size, 2)
    await base.shutdown()
  })
  test('non CI keys work', async () => {
    const base = await metrologyFactory('not-CI-key')
    await base.spawn('child1')
    await base.settle()
    const block = await base.getLatest()
    assert(block.validators.has('not-CI-key'))
    const publicKey = block.validators.get('not-CI-key')
    assert(ciKeypair.publicKey !== publicKey.key)
    await base.shutdown()

    const ci = await metrologyFactory()
    await ci.spawn('child1')
    await ci.settle()
    const ciBlock = await ci.getLatest()
    const ciPublicKey = ciBlock.validators.get('CI')
    assert.strictEqual(ciKeypair.publicKey, ciPublicKey.key)
    await ci.shutdown()
  })
  test('lexographic sorting of block height over 10', async () => {
    const base = await metrologyFactory()
    for (let i = 0; i < 10; i++) {
      await base.pierce('PING')
    }
    const baseBlock = await base.getLatest()
    assert.strictEqual(baseBlock.getHeight(), 10)
  })
  test.todo('config changes cause new block')
  test.todo('rename alias does not cause interblock')
  test.todo('automatic promises')
  test.todo('tick with no response is an instant resolve')
  test.todo('resolving an alias causes lineage fork')
  test.todo('reject if piercings for unpierced reducer')
  test.todo('triangular test for large numbers of pooled lineage')
})
