import assert from 'assert'
import * as crypto from '..'
import Benchmark from 'benchmark'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:crypto')

const testHash = crypto.objectHash('testHash')
describe('crypto', () => {
  let keypair
  beforeAll(async () => {
    keypair = await crypto.generateKeyPair()
  })

  const hashString = () => {
    const testString = 'test'
    const hash = crypto.objectHash(testString)
    const previous =
      'a46092d2aaf8df017b1ede7ef3a2d2a427eb23cc240bbf3687d69a1ba17f4a27'
    assert.strictEqual(hash, previous)
  }
  const hashObject = () => {
    const testObject = { some: 'test', obj: 'etc' }
    const hash = crypto.objectHash(testObject)
    assert.strictEqual(
      hash,
      '70b467b32a6ea695555039bc52eba599305f2cbeaa7e4b59ced78aed3a07aebb',
      'hash does not match the expected value'
    )
  }
  const generateKeyPair = async () => {
    const keyPair = await crypto.generateKeyPair()
    assert(keyPair)
  }
  const verifyKeyPair = async () => {
    const { publicKey, secretKey } = keypair
    const verified = await crypto.verifyKeyPair({
      publicKey,
      secretKey,
    })
    assert(verified)
  }
  const signHash = async () => {
    const { secretKey } = keypair
    const signature = await crypto.signHash(testHash, secretKey)
    assert(signature)
    return signature
  }
  const verifySignature = (signature) => async () => {
    const { publicKey } = keypair
    const verified = await crypto.verifyHash(testHash, signature, publicKey)
    assert(verified)
  }

  test.skip('benchmark', async () => {
    require('debug').enable('interblock:tests:crypto')
    jest.setTimeout(1000000)
    const suite = new Benchmark.Suite()
    let log = ''

    const { signature } = await signHash()
    await new Promise((resolve) => {
      suite
        .add('Generate Keypair', generateKeyPair, { async: true })
        .add('Verify Keypair', verifyKeyPair, { async: true })
        .add('Sign a hash', signHash, { async: true })
        .add('Verify signature', verifySignature(signature), {
          async: true,
        })
        .add('Hash a string', hashString)
        .add('Hash an object', hashObject)
        .on('cycle', (event) => {
          log += String(event.target) + '\n'
        })
        .on('complete', () => {
          resolve()
        })
        .run()
    })
    debug(log.trim())

    /**
    2020-02-01 tweetnacl default(fast) & slow
    Generate Keypair x 20.39 ops/sec ±6.57% (39 runs sampled)
    Sign objects x 17.57 ops/sec ±5.84% (33 runs sampled)
    Verify signed string x 20.00 ops/sec ±4.42% (36 runs sampled)
    Hash a string x 44,917 ops/sec ±1.98% (85 runs sampled)
    Hash an object x 36,145 ops/sec ±5.88% (78 runs sampled)

    2020-07-14 sodium-plus
    Generate Keypair x 452,981 ops/sec ±9.65% (36 runs sampled)
    Verify Keypair x 227,212 ops/sec ±13.87% (27 runs sampled)
    Sign a hash x 264,118 ops/sec ±4.58% (42 runs sampled)
    Verify signature x 258,182 ops/sec ±5.56% (62 runs sampled)
    Hash a string x 460,995 ops/sec ±5.23% (71 runs sampled)

    */
  })

  describe('hash function', () => {
    test('should hash a string', () => {
      const testString = 'test'
      const hash = crypto.objectHash(testString)
      const previous =
        'a46092d2aaf8df017b1ede7ef3a2d2a427eb23cc240bbf3687d69a1ba17f4a27'
      assert.strictEqual(hash, previous)
      const different = crypto.objectHash('different string')
      assert.notStrictEqual(hash, different)
    })
    test('should hash an object', () => {
      const testObject = { some: 'test', obj: 'etc' }
      const hash = crypto.objectHash(testObject)
      const previous =
        '70b467b32a6ea695555039bc52eba599305f2cbeaa7e4b59ced78aed3a07aebb'
      assert.strictEqual(hash, previous, 'hash does not match')
      const different = crypto.objectHash({
        ...testObject,
        obj: 'etd',
      })
      assert.notEqual(hash, different)
    })
    test('should hash objects deterministically', () => {
      const testObject = {
        attr1: 'val1',
        attr2: [1, 2, 3],
        attr3: { a: 1, b: 2 },
      }
      const testObjectReOrder = {
        attr3: { b: 2, a: 1 },
        attr2: [1, 2, 3],
        attr1: 'val1',
      }
      assert.strictEqual(
        crypto.objectHash(testObject),
        crypto.objectHash(testObjectReOrder),
        'same object hashed to different values'
      )
    })
    test('undefined values for different keys result in different hashes', () => {
      const m = crypto.objectHash({ m: undefined })
      const n = crypto.objectHash({ n: undefined })
      assert(m !== n)
      const o = crypto.objectHash({ o: null })
      const p = crypto.objectHash({ p: null })
      assert(o !== p)
    })
  })

  describe('generateKeyPair', () => {
    test('same pair from same seed', async () => {
      const seed = '0123456789abcdef0123456789abcdef'
      const other = '70b467b32a6ea695555039bc52eba591'
      const kp1 = await crypto.generateKeyPair(seed)
      const kp2 = await crypto.generateKeyPair(seed)
      const kp3 = await crypto.generateKeyPair(other)
      const noSeed1 = await crypto.generateKeyPair()
      const noSeed2 = await crypto.generateKeyPair()

      assert.deepStrictEqual(kp1, kp2)
      assert.notStrictEqual(kp2, kp3)
      assert.notStrictEqual(kp3, noSeed1)
      assert.notStrictEqual(noSeed1, noSeed2)
    })
  })
  describe('sign|verify', () => {
    test('verifies signatures for previous signed objects', async () => {
      const hash = crypto.objectHash('test hash')
      const { publicKey, secretKey } = keypair
      const { signature } = await crypto.signHash(hash, secretKey)
      assert(await crypto.verifyHash(hash, signature, publicKey))
      const tamp = 'a different hash'
      const isNotOk = await crypto.verifyHash(tamp, signature, publicKey)
      assert(!isNotOk)
      const isNotOkSync = crypto.verifyHashSync(tamp, signature, publicKey)
      assert(!isNotOkSync)
    })
    test('throws if hash not a secure hash', async () => {
      const notSecure = 'random'
      const secure = crypto.objectHash(notSecure)
      const { secretKey } = keypair

      await assert.rejects(crypto.signHash(notSecure, secretKey))
      assert.ok(await crypto.signHash(secure, secretKey))
    })
    test('caches already verified signatures', async () => {
      const { publicKey, secretKey } = await crypto.generateKeyPair()
      const { size } = crypto._verifiedSet
      const { signature } = await crypto.signHash(testHash, secretKey)
      assert.strictEqual(crypto._verifiedSet.size, size)
      assert(!crypto.verifyHashSync(testHash, signature, publicKey))
      const verified = await crypto.verifyHash(testHash, signature, publicKey)
      assert(verified)
      assert.strictEqual(crypto._verifiedSet.size, size + 1)
      assert(crypto.verifyHashSync(testHash, signature, publicKey))
    })
    test.todo('caches created signatures for instant verify')
    test.todo('alerts if asked to sign the same thing twice')
  })

  describe('verifyKeyPair()', () => {
    test('verifies a known good keypair', async () => {
      const { publicKey, secretKey } = keypair
      const isVerified = await crypto.verifyKeyPair({
        publicKey,
        secretKey,
      })
      assert.strictEqual(isVerified, true)
    })
    test('returns false for a known bad keyPair', async () => {
      const isVerifiedKeyPair = await crypto.verifyKeyPair({
        publicKey: 'random public key',
        secretKey: 'random secret key',
      })
      assert.strictEqual(isVerifiedKeyPair, false)
      const { secretKey } = await crypto.generateKeyPair()
      const { publicKey } = await crypto.generateKeyPair()
      const swapped = await crypto.verifyKeyPair({
        publicKey,
        secretKey,
      })
      assert(!swapped)
      assert(!crypto.verifyKeyPairSync(swapped))
    })
    test('caches already verified keypairs', async () => {
      const { size } = crypto._verifiedSet
      const keypair = await crypto.generateKeyPair()
      assert.strictEqual(crypto._verifiedSet.size, size + 1)
      assert(crypto.verifyKeyPairSync(keypair))
    })
    test.todo('caches created keypairs for instant verify')
  })

  describe('nonce', () => {
    test('short seed', () => {
      crypto.injectSeed('short seed')
      let nonce = crypto.generateNonce()
      assert.strictEqual(typeof nonce, 'string')
      assert.strictEqual(nonce.length, 32)
    })
    test('long seed', () => {
      crypto.injectSeed('so many Qs: QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ')
      const nonce = crypto.generateNonce()
      assert.strictEqual(typeof nonce, 'string')
      assert.strictEqual(nonce.length, 32)
    })
    test('random seed', () => {
      crypto.injectSeed('')
      const nonce = crypto.generateNonce()
      assert.strictEqual(typeof nonce, 'string')
      assert.strictEqual(nonce.length, 36)
    })
  })
})
