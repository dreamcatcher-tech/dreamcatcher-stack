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
    const clone = JSON.parse(JSON.stringify(sig.toArray()))
    assert(Signature.restore(clone))

    const degradedI = sig
      .update({ integrity: Integrity.create({ degraded: 'degraded' }) })
      .toArray()
    assert.throws(() => Signature.restore(degradedI), 'Could not verify')

    const degradedP = sig
      .update({ publicKey: keypairTamper.publicKey })
      .toArray()
    assert.throws(() => Signature.restore(degradedP), 'Could not verify')

    const { seal } = await signatureProducer.sign(integrity, keypairTamper)
    const degradedS = sig.update({ seal }).toArray()
    assert.throws(() => Signature.restore(degradedS), 'Could not verify')
  })
})
