import { assert } from 'chai/index.mjs'
import { Dmz, Provenance, Block, Keypair } from '..'
import * as crypto from '../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:tests:Block')
Debug.enable()

describe('block', () => {
  describe('instantiation', () => {
    test('default is verified genesis', () => {
      const defaultBlock = Block.create()
      assert(defaultBlock.provenance.address.isGenesis())
      assert(defaultBlock.isVerifiedBlock())
    })
    test('default serialization', () => {
      const defaultBlock = Block.create()
      const json = JSON.stringify(defaultBlock.toArray(), null, 2)
      assert.strictEqual(typeof json, 'string')
      const clone = Block.restore(JSON.parse(json))
      assert.deepEqual(defaultBlock.toArray(), clone.toArray())
    })
    const rawKeys = crypto.generateKeyPair()
    test('custom key isVerifiedBlock', () => {
      const keypair = Keypair.create('CUSTOM-KEY', rawKeys)
      const dmz = Dmz.create({
        validators: keypair.getValidatorEntry(),
      })
      const defaultBlock = Block.create(dmz)
      assert(defaultBlock.isVerifiedBlock())
    })
    test('genesis has no signature checks', () => {
      const kp = crypto.generateKeyPair()
      const different = Keypair.create('FOREIGN_VALIDATOR', kp)
      const child = Dmz.create({
        validators: different.getValidatorEntry(),
      })
      const block = Block.create(child)
      assert(block.isVerifiedBlock())
    })
    test('generate unique genesis by default', () => {
      const dmz = Dmz.create()
      const block = Block.create(dmz)
      const clone = Block.clone(block.spread())
      assert(clone instanceof Block)
      assert(clone.deepEquals(block))
      const second = Block.create(dmz)
      assert(!second.deepEquals(block))
      assert(block.hashString() !== second.hashString())
      assert(block.getChainId() !== second.getChainId())
    })
    test('check of provenance passes', () => {
      const dmz = Dmz.create()
      const block = Block.create(dmz)
      assert(block.isVerifiedBlock())

      const array = JSON.parse(JSON.stringify(dmz.toArray()))
      const dmzClone = Dmz.restore(array)
      assert.deepEqual(dmz.toArray(), dmzClone.toArray())
      assert.deepEqual(dmz.toJS(), dmzClone.toJS())
      assert(dmz.deepEquals(dmzClone))
      const pArr = block.provenance.toArray()
      const pRaw = JSON.parse(JSON.stringify(pArr))
      const pClone = Provenance.restore(pRaw)
      const clone = Block.clone({
        ...dmzClone.spread(),
        provenance: pClone,
      })
      assert(clone.isVerifiedBlock())
    })
    test('validation throws if provenance does not match', () => {
      const dmz1 = Dmz.create()
      const dmz2 = Dmz.create({ config: { isPierced: true } })
      assert(!dmz1.deepEquals(dmz2))

      const b1 = Block.create(dmz1)
      const b2 = Block.create(dmz2)
      const degraded = { ...b1.spread(), provenance: b2.provenance }
      assert.throws(() => Block.clone(degraded), 'hash mismatch')
    })
    test.todo('changed validators uses previous validators for current block')
    test.todo('can provide initial parameters to make a block from')
    test.todo('throws if provenance does not match dmz')
    test.todo('no self channel allowed')
  })
  describe('signatures controlled by dmz.validators', () => {
    test.todo('throws on additional signatures')
    test.todo('throws if tries to create a block but has no right to sign it')
  })
  test.todo('check for partially validated blocks produced during consensus')
})
