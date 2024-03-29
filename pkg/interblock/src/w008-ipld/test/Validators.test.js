import { Validators, Keypair } from '..'
import { assert } from 'chai/index.mjs'

describe('Validators', () => {
  test('ci', () => {
    const validators = Validators.createCI()
    assert.strictEqual(validators.publicKeys.length, 1)
    assert.strictEqual(validators.quorumThreshold, 1)
  })
  test('crush', async () => {
    const validators = Validators.createCI()
    const crushed = await validators.crushToCid()
    const diff = crushed.getDiffBlocks()
    assert.strictEqual(diff.size, 2)
  })
  test('multiple', async () => {
    const k1 = await Keypair.generate('K1')
    const k2 = await Keypair.generate('K2')
    const validators = Validators.create([k1.publicKey, k2.publicKey])
    assert.strictEqual(validators.publicKeys.length, 2)
    assert.strictEqual(validators.quorumThreshold, 2)
  })
  test('no duplications', () => {
    const k1 = Keypair.createCI('K1')
    const k2 = Keypair.createCI('K2')
    const keys = [k1.publicKey, k2.publicKey]
    assert.throws(() => Validators.create(keys), 'duplicate')
  })
})
