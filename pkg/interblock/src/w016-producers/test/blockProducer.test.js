import chai, { assert } from 'chai/index.mjs'
import { keypairModel, blockModel, dmzModel } from '../../w015-models'
import { blockProducer, signatureProducer } from '../../w016-producers'
import * as crypto from '../../w012-crypto'

describe('blockProducer', () => {
  describe('generateNext', () => {
    test('false signing rejected', async () => {
      const block = blockModel.create()
      const keypairA = keypairModel.create('keypairA')
      const keypairB = keypairModel.create('keypairB')
      const dmz = dmzModel.create({
        state: { test: 'changedState' },
        validators: keypairA.getValidatorEntry(),
      })
      const unsigned = blockProducer.generateUnsigned(dmz, block)
      assert(!unsigned.isVerifiedBlock())
      const { integrity } = unsigned.provenance
      const signature = await signatureProducer.sign(integrity, keypairA)
      const next = blockProducer.assemble(unsigned, signature)
      assert(next.isVerifiedBlock())
      assert(block.isNextBlock(next))

      const falseSignature = await signatureProducer.sign(integrity, keypairB)
      assert(!falseSignature.equals(signature))
      assert.throws(() => blockProducer.assemble(unsigned, falseSignature))
    })
    test('throws if no dmz or block provided', () => {
      assert.throws(blockProducer.generateUnsigned)
      const dmz = dmzModel.create()
      assert.throws(() => blockProducer.generateUnsigned(dmz))
    })
    test('no duplicates created', () => {
      const block = blockModel.create()
      const dmz = block.getDmz()
      assert.throws(() => blockProducer.generateUnsigned(dmz, block))
    })
    test('pass serialize test', () => {
      const block = blockModel.create()
      const state = { test: 'state' }
      const nextDmz = dmzModel.clone({ ...block.getDmz(), state })
      const nextBlock = blockProducer.generateUnsigned(nextDmz, block)
      const json = nextBlock.serialize()
      assert.strictEqual(typeof json, 'string')
      const clone = blockModel.clone(json)
      assert(clone.equals(nextBlock))
    })
    test.skip('dual validator signing', () => {
      const kp1 = crypto.generateKeyPair()
      const kp2 = crypto.generateKeyPair()
      const keypair1 = keypairModel.create('CI1', kp1)
      const keypair2 = keypairModel.create('CI2', kp2)
      const duo = dmzModel.create({
        validators: { alice: keypair1.publicKey, bob: keypair2.publicKey },
      })
    })
  })
})
