import { assert } from 'chai/index.mjs'
import { Keypair } from '../../src/classes'
import * as crypto from '../../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:tests:Keypair')
Debug.enable('*Keypair')

describe('keypair', () => {
  const kp1 = crypto.generateKeyPair()
  const kp2 = crypto.generateKeyPair()
  test('verifies keys on load', async () => {
    const keypairDefault1 = Keypair.create()
    const keypairDefault2 = Keypair.create()
    const keypair1 = Keypair.create('KP1', kp1)
    const keypair2 = Keypair.create('KP2', kp2)
    assert(keypair1 instanceof Keypair)

    const js = JSON.parse(JSON.stringify(keypair1.toJS()))
    assert.strictEqual(js.publicKey.algorithm, keypair1.publicKey.algorithm)
    assert.throws(() => (keypair1.added = 5))

    assert.strictEqual(keypairDefault1.name, 'CI')
    assert(keypairDefault1.equals(keypairDefault2))
    assert(!keypair1.equals(keypair2))
    assert(!keypairDefault1.equals(keypair1))

    const kp1Arr = keypair1.toArray()
    const kp2Arr = keypair2.toArray()
    const restored = Keypair.restore(kp1Arr)
    assert.deepEqual(keypair1.toArray(), restored.toArray())
    kp1Arr[2] = kp2Arr[2]
    assert.throws(() => Keypair.restore(kp1Arr))
    assert.throws(() => (restored.alter = 'immutable'))
  })

  test('default create is same each time', () => {
    const s1 = Keypair.create()
    const s2 = Keypair.create()
    assert(s1.equals(s2))
    const c1 = Keypair.restore(s1.toArray())
    const c2 = Keypair.restore(s2.toArray())
    assert.deepEqual(c1.toArray(), c2.toArray())
    assert.deepEqual(c1.toJS(), c2.toJS())
  })
  test('create with same seed is same', () => {
    const kp1 = crypto.generateKeyPair()
    const s1 = Keypair.create('test1', kp1)
    const s2 = Keypair.create('test1', kp1)
    assert.deepEqual(s1.toJS(), s2.toJS())
    assert.strictEqual(s1.secretKey, kp1.secretKey)
    assert.strictEqual(s1.publicKey.key, kp1.publicKey)
  })
})
