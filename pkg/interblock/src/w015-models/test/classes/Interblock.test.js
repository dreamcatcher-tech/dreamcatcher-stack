import { assert } from 'chai/index.mjs'
import {
  Action,
  Address,
  Block,
  Channel,
  Dmz,
  Integrity,
  Interblock,
  Network,
} from '../../src/classes'
import Debug from 'debug'
const debug = Debug('interblock:tests:Interblock')
Debug.enable('*:Interblock')

const createBlockWithEffects = (actionType = 'INTERBLOCK_TEST') => {
  const address = Address.create('TEST')
  const blank = Channel.create(address)
  const request = Action.create(actionType)
  const precedent = Integrity.create('FAKE_PRECEDENT')
  const channel = blank.update({ requests: [request], precedent })
  const network = Network.create({ effects: channel })
  const opts = { network }
  const dmz = Dmz.create(opts)
  const validatedBlock = Block.create(dmz)
  return validatedBlock
}

describe('interblock', () => {
  describe('create', () => {
    test('create', () => {
      const block = createBlockWithEffects()
      const interblock = Interblock.create(block, 'effects')
      assert(interblock)
      const restore = Interblock.restore(interblock.toArray())
      assert(restore.deepEquals(interblock))
      const json = JSON.parse(JSON.stringify(interblock.toArray()))
      const fromJson = Interblock.restore(json)
      assert.deepEqual(fromJson.toJS(), interblock.toJS())
      assert.deepEqual(fromJson.toArray(), interblock.toArray())
    })
    test('interblock must have validated block and alias', () => {
      const block = createBlockWithEffects()
      assert.throws(() => Interblock.create())
      assert.throws(() => Interblock.create(block))
      assert(Interblock.create(block, 'effects'))
      const genesis = blockModel.create()
      assert.throws(() => Interblock.create(genesis))
      assert.throws(() => Interblock.create(genesis, 'not present'))
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
    const interblock = Interblock.create(block, 'effects')
    const tamper = JSON.parse(JSON.stringify(interblock))
    const clone = Interblock.clone(tamper)
    assert(clone)
    assert.strictEqual(tamper.network.effects.requests[0].type, type)
    console.log(tamper.network.effects)
    tamper.network.effects.requests[0].type = 'TAMP'
    console.log(tamper.network.effects)
    assert.throws(() => Interblock.clone(tamper))
  })
  test.todo('includes')
  test.todo('reject if replies not monotonic ? or promises ?')
  test.todo('allow multiple channels in a single interblock')
  test.todo('transmit on genesis')
  test.todo('receive two interblocks during a single blockmaking cycle')
  test('speed', () => {
    const block = createBlockWithEffects('NO_CACHE')
    const start = Date.now()
    const interblock = Interblock.create(block, 'effects')
    assert(interblock.network.effects)
    interblock.getRemote()
    const elapsed = Date.now() - start
    assert(elapsed <= 3, `speed was: ${elapsed}`)
  })
})
