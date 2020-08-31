const assert = require('assert')
const { metrologyFactory } = require('../src/metrologyFactory')

describe('standardEngine', () => {
  test('multiple increase requests only lock chain twice', async () => {
    const base = await metrologyFactory()
    const { sqsIncrease, ioConsistency } = base.getEngine()
    assert.equal(base.getHeight(), 0)
    const address = base.getState().provenance.getAddress()
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
    const increases = Array(100).fill(address)
    increases.map(sqsIncrease.push)
    await base.settle()
    assert.equal(lockCount, unlockCount)
    assert.equal(lockCount, 2)
    assert.equal(base.getHeight(), 0)
  })
})
