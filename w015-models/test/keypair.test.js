const assert = require('assert')
const { keypairModel } = require('..')
const crypto = require('../../w012-crypto')
require('../../w012-crypto').testMode()

describe('keypair', () => {
  test('verifies keys on load', async () => {
    const kp1 = await crypto.generateKeyPair()
    const kp2 = await crypto.generateKeyPair()
    const keypairDefault1 = keypairModel.create()
    const keypairDefault2 = keypairModel.create()
    const keypair1 = keypairModel.create('KP1', kp1)
    const keypair2 = keypairModel.create('KP2', kp2)
    assert(keypairDefault1.equals(keypairDefault2))
    assert(!keypair1.equals(keypair2))
    assert(!keypairDefault1.equals(keypair1))
    const degraded = { ...keypair1, publicKey: keypair2.publicKey }
    assert.throws(() => keypairModel.clone(degraded))
    assert.equal(keypairDefault1.name, 'CI')
  })

  test('default create is same each time', () => {
    const s1 = keypairModel.create()
    const s2 = keypairModel.create()
    assert(s1.equals(s2))
    const c1 = keypairModel.clone()
    const c2 = keypairModel.clone()
    assert.equal(c1, c2)
  })
  test('create with same seed is same', async () => {
    const kp1 = await crypto.generateKeyPair()
    const s1 = await keypairModel.create('CI', kp1)
    const s2 = await keypairModel.create('CI', kp1)
    assert(s1.equals(s2))
  })
  test('refuse to sign blank inputs', async () => {
    const keypair = await keypairModel.create()
    await assert.rejects(keypair.sign)
  })
})
