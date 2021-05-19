const assert = require('assert')
const debug = require('debug')('interblock:tests:isolate')
const { ioQueueFactory } = require('../../w003-queue')
const {
  isolateFactory,
  toFunctions,
} = require('../src/services/isolateFactory')
const {
  rxRequestModel,
  covenantIdModel,
  dmzModel,
  blockModel,
} = require('../../w015-models')
require('debug').enable()
describe('isolation', () => {
  test('handle two covenants', async () => {
    const reducer1 = () => ({
      test: 'reducer1',
    })
    const reducer2 = () => ({
      test: 'reducer2',
    })
    const covenantMap = {
      reducer1: { reducer: reducer1 },
      reducer2: { reducer: reducer2 },
    }
    let covenantId = covenantIdModel.create('reducer1')
    const block1 = await blockModel.create(dmzModel.create({ covenantId }))
    covenantId = covenantIdModel.create('reducer2')
    const block2 = await blockModel.create(dmzModel.create({ covenantId }))

    const fakeConsistency = ioQueueFactory('fakeConsistency')
    const isolateProcessor = isolateFactory(fakeConsistency, covenantMap)
    const queue = ioQueueFactory('testIsolate')
    queue.setProcessor(isolateProcessor)
    const isolate = toFunctions(queue)

    const id1 = isolate.loadCovenant(block1)
    const id2 = isolate.loadCovenant(block2)

    const address = block1.provenance.getAddress()
    const payload = {}
    const index = 0
    const action1 = rxRequestModel.create('action12', payload, address, index)
    const action2 = rxRequestModel.create('action2', payload, address, index)
    const tick1 = {
      containerId: await id1,
      state: {},
      action: action1,
    }
    const tick2 = {
      containerId: await id2,
      state: {},
      action: action2,
    }
    const r1Await = isolate.tick(tick1)
    const r2Await = isolate.tick(tick2)
    const r1 = await r1Await
    const r2 = await r2Await

    assert.deepStrictEqual(r1.reduction, { test: 'reducer1' })
    assert.deepStrictEqual(r2.reduction, { test: 'reducer2' })

    debug(`unload tests`)
    await assert.rejects(() => isolate.unloadCovenant('not valid containerId'))
    debug(`unloading id1`)
    await isolate.unloadCovenant(await id1)
    debug(`attempting tick1`)
    await assert.rejects(() => isolate.tick(tick1))

    assert.deepStrictEqual(await id1, block1.provenance.reflectIntegrity().hash)
  })
  test('reducer throw propogates back', async () => {
    const reducerThrower = () => {
      throw new Error(`reducerThrower`)
    }
    const covenantMap = {
      reducer1: { reducer: reducerThrower },
    }
    let covenantId = covenantIdModel.create('reducer1')
    const block1 = await blockModel.create(dmzModel.create({ covenantId }))

    const fakeConsistency = ioQueueFactory('fakeConsistency')
    const isolateProcessor = isolateFactory(fakeConsistency, covenantMap)
    const queue = ioQueueFactory('testIsolate')
    queue.setProcessor(isolateProcessor)
    const isolate = toFunctions(queue)

    const containerId = await isolate.loadCovenant(block1)
    const address = block1.provenance.getAddress()
    const index = 0
    const action = rxRequestModel.create('action1', {}, address, index)
    const tick1 = {
      containerId,
      state: {},
      action,
      accumulator: [],
      timeout: 30000,
    }
    await assert.rejects(
      () => isolate.tick(tick1),
      (error) => {
        assert.strictEqual(error.message, 'reducerThrower')
        return true
      }
    )
  })
})
