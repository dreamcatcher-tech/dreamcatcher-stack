const assert = require('assert')
const {
  dmzModel,
  provenanceModel,
  blockModel,
  keypairModel,
  cryptoCacher,
} = require('..')
const crypto = require('../../w012-crypto')

describe('block', () => {
  describe.only('instantiation', () => {
    test('default isValidated', async () => {
      const defaultBlock = await blockModel.create()
      assert(defaultBlock.isValidated())
    })
    test('default serialization', async () => {
      const defaultBlock = await blockModel.create()
      const json = defaultBlock.serialize()
      const clone = blockModel.clone(json)
      assert(defaultBlock.equals(clone))
    })
    test('custom key isValidated', async () => {
      const keypair = keypairModel.create('CUSTOM-KEY')
      const dmz = dmzModel.create({
        validators: keypair.getValidatorEntry(),
      })
      const defaultBlock = await blockModel.create(dmz, keypair.sign) // TODO move to block producer
      assert(defaultBlock.isValidated())
    })
    test('genesis can be signed by any key', async () => {
      const keypair = await keypairModel.create('SPAWN')
      const kp = await crypto.generateKeyPair()
      const different = keypairModel.create('FOREIGN_VALIDATOR', kp)
      const child = dmzModel.create({
        validators: different.getValidatorEntry(),
      })
      const block = await blockModel.create(child, keypair.sign)
      assert(block.isValidated())
    })
    test.todo('changed validators uses previous validators for current block')
    test('generate unique genesis by default', async () => {
      const block = await blockModel.create()
      const clone = blockModel.clone(block)
      assert(clone.equals(block))
      assert(blockModel.isModel(clone))
      const second = await blockModel.create()
      assert(second !== block)
    })

    test('check of provenance passes', async () => {
      const dmz = dmzModel.create()
      const provenance = await provenanceModel.create(dmz)
      const block = blockModel.clone({ ...dmz, provenance })
      assert(block && typeof block.isValidated === 'function')

      const dmzClone = dmzModel.clone(dmz.serialize())
      const provenanceClone = provenanceModel.clone(provenance.serialize())
      const clone = blockModel.clone({
        ...dmzClone,
        provenance: provenanceClone,
      })
      assert(clone && typeof clone.isValidated === 'function')
    })
    test.todo('can provide initial parameters to make a block from')
    test.todo('throws if provenance does not match dmz')
    test('validation throws if provenance does not match', () => {
      const dmz1 = dmzModel.create()
      const dmz2 = dmzModel.create({ config: { isPierced: true } })
      assert(dmz1 !== dmz2)

      const b1 = blockModel.create(dmz1)
      const b2 = blockModel.create(dmz2)

      assert.throws(() =>
        blockModel.clone({
          ...b1,
          provenance: b2.provenance,
        })
      )
    })
    test.todo('no self channel allowed')
  })
  describe('signatures controlled by dmz.validators', () => {
    test.todo('throws on additional signatures')
    test.todo('throws if tries to create a block but has no right to sign it')
  })
  test.todo('check for partially validated blocks produced during consensus')
  test.skip('dual validator signing', async () => {
    const kp1 = await crypto.generateKeyPair()
    const kp2 = await crypto.generateKeyPair()
    const keypair1 = keypairModel.create('CI1', kp1)
    const keypair2 = keypairModel.create('CI2', kp2)
    const duo = dmzModel.create({
      validators: { alice: keypair1.publicKey, bob: keypair2.publicKey },
    })
    // TODO how to test dual block signing ?
  })
})
