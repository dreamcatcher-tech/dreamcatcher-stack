import { assert } from 'chai/index.mjs'
import {
  dmzModel,
  actionModel,
  networkModel,
  interblockModel,
  blockModel,
  channelModel,
  addressModel,
  integrityModel,
} from '..'

const createBlockWithEffects = (actionType = 'INTERBLOCK_TEST') => {
  const address = addressModel.create('TEST')
  const blank = channelModel.create(address)
  const request = actionModel.create(actionType)
  const precedent = integrityModel.create('FAKE_PRECEDENT')
  const channel = channelModel.clone({
    ...blank,
    requests: [request],
    precedent,
  })
  const network = networkModel.create({ effects: channel })
  const opts = { network }
  const dmz = dmzModel.create(opts)
  const validatedBlock = blockModel.create(dmz)
  return validatedBlock
}

describe('interblock', () => {
  describe('create', () => {
    test('create', () => {
      const block = createBlockWithEffects()
      const interblock = interblockModel.create(block, 'effects')
      assert(interblock)
      const clone = interblockModel.clone(interblock)
      assert(clone.equals(interblock))
      assert.throws(interblockModel.clone)
    })
    test('interblock must have validated block and alias', () => {
      const block = createBlockWithEffects()
      assert.throws(() => interblockModel.create())
      assert.throws(() => interblockModel.create(block))
      assert(interblockModel.create(block, 'effects'))
      const genesis = blockModel.create()
      assert.throws(() => interblockModel.create(genesis))
      assert.throws(() => interblockModel.create(genesis, 'not present'))
    })
    test.todo('throws if no valid address to send to')
    test.todo(
      'two interblocks from one block'
      // show interblock creation for two different tx chains,
      // from the same original block
      // show the integrity create and check functions are modular
      // check no name leakage inside network key
    )
  })
  test.todo('proof only has block proof if no network alias')
  test.todo('getTargetAddress handles undefined address in provenance only')
  test.todo('must contain at least a request or a reply')
  test.skip('interblock transmit channel tamper detection', () => {
    const type = 'TAMPER'
    const block = createBlockWithEffects(type)
    const interblock = interblockModel.create(block, 'effects')
    const tamper = JSON.parse(JSON.stringify(interblock))
    const clone = interblockModel.clone(tamper)
    assert(clone)
    assert.strictEqual(tamper.network.effects.requests[0].type, type)
    console.log(tamper.network.effects)
    tamper.network.effects.requests[0].type = 'TAMP'
    console.log(tamper.network.effects)
    assert.throws(() => interblockModel.clone(tamper))
  })
  test.todo('includes')
  test.todo('reject if replies not monotonic ? or promises ?')
  test.todo('allow multiple channels in a single interblock')
  test.todo('transmit on genesis')
  test.todo('receive two interblocks during a single blockmaking cycle')
  test('speed', () => {
    const block = createBlockWithEffects('NO_CACHE')
    const start = Date.now()
    const interblock = interblockModel.create(block, 'effects')
    assert(interblock.network.effects)
    interblock.getRemote()
    const elapsed = Date.now() - start
    assert(elapsed <= 3, `speed was: ${elapsed}`)
  })
})
