import { assert } from 'chai/index.mjs'
import { dmzModel, provenanceModel, blockModel, keypairModel } from '..'
import * as crypto from '../../w012-crypto'

describe('block', () => {
  describe('instantiation', () => {
    test('default is verified genesis', () => {
      const defaultBlock = blockModel.create()
      assert(defaultBlock.provenance.address.isGenesis())
      assert(defaultBlock.isVerifiedBlock())
    })
    test('default serialization', () => {
      const defaultBlock = blockModel.create()
      const json = defaultBlock.serialize()
      assert.strictEqual(typeof json, 'string')
      const clone = blockModel.clone(json)
      assert(defaultBlock.equals(clone))
    })
    test('custom key isVerifiedBlock', () => {
      const rawKeys = crypto.generateKeyPair()
      const keypair = keypairModel.create('CUSTOM-KEY', rawKeys)
      const dmz = dmzModel.create({
        validators: keypair.getValidatorEntry(),
      })
      const defaultBlock = blockModel.create(dmz)
      assert(defaultBlock.isVerifiedBlock())
    })
    test('genesis has no signature checks', () => {
      const kp = crypto.generateKeyPair()
      const different = keypairModel.create('FOREIGN_VALIDATOR', kp)
      const child = dmzModel.create({
        validators: different.getValidatorEntry(),
      })
      const block = blockModel.create(child)
      assert(block.isVerifiedBlock())
    })
    test('generate unique genesis by default', () => {
      const dmz = dmzModel.create()
      const block = blockModel.create(dmz)
      const clone = blockModel.clone(block)
      assert(clone.equals(block))
      assert(blockModel.isModel(clone))
      const second = blockModel.create(dmz)
      assert(!second.equals(block))
      assert(block.getHash() !== second.getHash())
      assert(block.getChainId() !== second.getChainId())
    })
    test('check of provenance passes', () => {
      const dmz = dmzModel.create()
      const provenance = provenanceModel.create(dmz)
      const block = blockModel.clone({ ...dmz, provenance })
      assert(block.isVerifiedBlock())

      const dmzClone = dmzModel.clone(dmz.serialize())
      const provenanceClone = provenanceModel.clone(provenance.serialize())
      const clone = blockModel.clone({
        ...dmzClone,
        provenance: provenanceClone,
      })
      assert(clone.isVerifiedBlock())
    })
    test('validation throws if provenance does not match', () => {
      const dmz1 = dmzModel.create()
      const dmz2 = dmzModel.create({ config: { isPierced: true } })
      assert(!dmz1.equals(dmz2))

      const b1 = blockModel.create(dmz1)
      const b2 = blockModel.create(dmz2)

      assert.throws(() =>
        blockModel.clone({
          ...b1,
          provenance: b2.provenance,
        })
      )
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
