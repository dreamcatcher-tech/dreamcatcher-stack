import assert from 'assert'
const { integrityModel, signatureModel, keypairModel } = require('..')
const crypto = require('../../w012-crypto')

describe('signature', () => {
  test('throws on create attempts', () => {
    assert.throws(signatureModel.create)
  })
  test('rejects on tampered integrity', async () => {
    const integrity = integrityModel.create({ tamper: 'tamper detection' })
    const kp1 = await crypto.generateKeyPair()
    const kp2 = await crypto.generateKeyPair()
    const keypair = keypairModel.create('kp1', kp1)
    const keypairTamper = keypairModel.create('kp2', kp2)
    const sig = await keypair.sign(integrity)
    const clone = JSON.parse(JSON.stringify(sig))
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
    const { seal } = await keypairTamper.sign(integrity)
    const degradedSeal = {
      ...clone,
      seal,
    }
    assert.throws(() => signatureModel.clone(degradedSeal))
  })
})
