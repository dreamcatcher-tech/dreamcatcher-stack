import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { ioQueueFactory } from '../../w003-queue'
import { isolateFactory, toFunctions } from '../src/services/isolateFactory'
import {
  rxRequestModel,
  covenantIdModel,
  dmzModel,
  Block,
} from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:tests:isolate')
chai.use(chaiAsPromised)

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
    const block1 = Block.create(dmzModel.create({ covenantId }))
    covenantId = covenantIdModel.create('reducer2')
    const block2 = Block.create(dmzModel.create({ covenantId }))

    const fakeConsistency = ioQueueFactory('fakeConsistency')
    const isolateProcessor = isolateFactory(fakeConsistency, covenantMap)
    const queue = ioQueueFactory('testIsolate')
    queue.setProcessor(isolateProcessor)
    const isolate = toFunctions(queue)

    const id1 = isolate.loadCovenant(block1)
    const id2 = isolate.loadCovenant(block2)

    const address = block1.provenance.getAddress()
    const payload = {}
    const i = 0
    const h = 0
    const action1 = rxRequestModel.create('action1', payload, address, h, i)
    const action2 = rxRequestModel.create('action2', payload, address, h, i)
    const accumulator = []
    const tick1 = {
      containerId: await id1,
      state: {},
      action: action1,
      accumulator,
    }
    const tick2 = {
      containerId: await id2,
      state: {},
      action: action2,
      accumulator,
    }
    const r1Await = isolate.tick(tick1)
    const r2Await = isolate.tick(tick2)
    const r1 = await r1Await
    const r2 = await r2Await

    assert.deepEqual(r1.reduction, { test: 'reducer1' })
    assert.deepEqual(r2.reduction, { test: 'reducer2' })

    debug(`unload tests`)
    await assert.isRejected(isolate.unloadCovenant('not valid containerId'))
    debug(`unloading id1`)
    await isolate.unloadCovenant(await id1)
    debug(`attempting tick1`)
    await assert.isRejected(isolate.tick(tick1))

    assert.deepEqual(await id1, block1.provenance.reflectIntegrity().hash)
  })
  test('reducer throw propogates back', async () => {
    const reducerThrower = () => {
      throw new Error(`reducerThrower`)
    }
    const covenantMap = {
      reducer1: { reducer: reducerThrower },
    }
    let covenantId = covenantIdModel.create('reducer1')
    const block1 = Block.create(dmzModel.create({ covenantId }))

    const fakeConsistency = ioQueueFactory('fakeConsistency')
    const isolateProcessor = isolateFactory(fakeConsistency, covenantMap)
    const queue = ioQueueFactory('testIsolate')
    queue.setProcessor(isolateProcessor)
    const isolate = toFunctions(queue)

    const containerId = await isolate.loadCovenant(block1)
    const address = block1.provenance.getAddress()
    const height = 0
    const index = 0
    const action = rxRequestModel.create('action1', {}, address, height, index)
    const tick1 = {
      containerId,
      state: {},
      action,
      accumulator: [],
      timeout: 30000,
    }
    await assert.isRejected(isolate.tick(tick1), 'reducerThrower')
  })
  test.todo(`queries after hook execution are rejected`)
})
