import { assert } from 'chai/index.mjs'
import { signatureProducer } from '..'
import { Integrity, Keypair, Signature } from '../../w015-models'

describe('signatureProducer', () => {
  test('rejects on tampered integrity', async () => {
    const integrity = Integrity.create({ tamper: 'tamper detection' })
    const keypair = Keypair.create('kp1')
    const keypairTamper = Keypair.create('kp2')
    assert(keypair.secretKey !== keypairTamper.secretKey)

    const sig = await signatureProducer.sign(integrity, keypair)
    const json = sig.serialize()
    assert.strictEqual(typeof json, 'string')

    const clone = JSON.parse(json)
    assert(Signature.clone(clone))

    const degradedIntegrity = {
      ...clone,
      integrity: Integrity.create({ degraded: 'degraded' }),
    }
    assert.throws(() => Signature.clone(degradedIntegrity))

    const degradedPubkey = {
      ...clone,
      publicKey: keypairTamper.publicKey,
    }
    assert.throws(() => Signature.clone(degradedPubkey))

    const { seal } = await signatureProducer.sign(integrity, keypairTamper)
    const degradedSeal = {
      ...clone,
      seal,
    }
    assert.throws(() => Signature.clone(degradedSeal))
  })
})
