import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '../src/metrologyFactory'
describe('standardEngine', () => {
  test('multiple increase requests successfully lock chain twice', async () => {
    const base = await metrologyFactory()
    const { sqsIncrease, ioConsistency } = base.getEngine()
    let baseBlock = await base.getLatest()
    assert.strictEqual(baseBlock.getHeight(), 0)
    const address = baseBlock.provenance.getAddress()
    let lockCount = 0
    let unlockCount = 0
    ioConsistency.subscribe((action) => {
      switch (action.type) {
        case 'LOCK':
          lockCount++
          break
        case 'UNLOCK':
          unlockCount++
          break
      }
    })
    const increases = Array(10).fill(address)
    increases.map(sqsIncrease.push)
    await base.settle()
    assert.strictEqual(lockCount, unlockCount)
    assert.strictEqual(lockCount, 2)
    // TODO make compatible with runInBand
    baseBlock = await base.getLatest()
    assert.strictEqual(baseBlock.getHeight(), 0)
  })

  test.todo(
    'can increase chain before transmit is completed'
    // replace transmit with a complete dud
    // observe two unlocks occuring
  )
})
