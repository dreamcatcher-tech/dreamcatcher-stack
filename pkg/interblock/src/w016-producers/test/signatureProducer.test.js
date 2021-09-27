import { assert } from 'chai/index.mjs'
import { integrityModel, signatureModel, keypairModel } from '../../w015-models'
import { signatureProducer } from '..'

describe('signatureProducer', () => {
  test('rejects on tampered integrity', async () => {
    const integrity = integrityModel.create({ tamper: 'tamper detection' })
    const keypair = keypairModel.create('kp1')
    const keypairTamper = keypairModel.create('kp2')
    assert(keypair.secretKey !== keypairTamper.secretKey)

    const sig = await signatureProducer.sign(integrity, keypair)
    const json = sig.serialize()
    assert.strictEqual(typeof json, 'string')

    const clone = JSON.parse(json)
    assert(signatureModel.clone(clone))

    const degradedIntegrity = {
      ...clone,
      integrity: integrityModel.create({ degraded: 'degraded' }),
    }
    assert.throws(() => signatureModel.clone(degradedIntegrity))

    const degradedPubkey = {
      ...clone,
      publicKey: keypairTamper.publicKey,
    }
    assert.throws(() => signatureModel.clone(degradedPubkey))

    const { seal } = await signatureProducer.sign(integrity, keypairTamper)
    const degradedSeal = {
      ...clone,
      seal,
    }
    assert.throws(() => signatureModel.clone(degradedSeal))
  })
})
