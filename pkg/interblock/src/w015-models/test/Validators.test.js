import { Validators, Keypair } from '..'
import { ciKeypair } from '../../w012-crypto'
import { assert } from 'chai/index.mjs'

describe('Validators', () => {
  const k1 = Keypair.create('K1')
  const k2 = Keypair.create('K2')
  test('ci', () => {
    const validators = Validators.create()
    const js = validators.toJS()
    assert.strictEqual(js.CI.algorithm, 'noble-secp256k1')
    assert.strictEqual(js.CI.key, ciKeypair.publicKey)
  })
  test('multiple', () => {
    const map = Object.assign(
      {},
      k1.getValidatorEntry(),
      k2.getValidatorEntry()
    )
    const validators = Validators.create(map)
    assert.strictEqual(Object.keys(validators.toJS()).length, 2)

    const array = validators.toArray()
    const restored = Validators.restore(array)
    assert.deepEqual(validators.toArray(), restored.toArray())
  })
  test('no duplications', () => {
    const k1 = Keypair.create()
    const base = k1.getValidatorEntry()
    const v1 = { K1: base.CI }
    const v2 = { K2: base.CI }
    const map = Object.assign({}, v1, v2)
    assert.strictEqual(Object.keys(map).length, 2)
    assert.strictEqual(map.K1.key, map.K2.key)
    assert.throws(() => Validators.create(map))
  })
})
