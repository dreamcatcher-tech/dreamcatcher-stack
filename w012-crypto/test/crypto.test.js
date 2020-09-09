const assert = require('assert')
const sodium = require('../src/sodium')
const Benchmark = require('benchmark')
const debug = require('debug')('interblock:tests:crypto')

const testHash = sodium.objectHash('testHash')
describe('crypto', () => {
  let keypair
  beforeAll(async () => {
    keypair = await sodium.generateKeyPair()
  })

  const hashString = () => {
    const testString = 'test'
    const hash = sodium.objectHash(testString)
    const previous =
      'a46092d2aaf8df017b1ede7ef3a2d2a427eb23cc240bbf3687d69a1ba17f4a27'
    assert.equal(hash, previous)
  }
  const hashObject = () => {
    const testObject = { some: 'test', obj: 'etc' }
    const hash = sodium.objectHash(testObject)
    assert.equal(
      hash,
      '70b467b32a6ea695555039bc52eba599305f2cbeaa7e4b59ced78aed3a07aebb',
      'hash does not match the expected value'
    )
  }
  const generateKeyPair = async () => {
    const keyPair = await sodium.generateKeyPair()
    assert(keyPair)
  }
  const verifyKeyPair = async () => {
    const { publicKey, secretKey } = keypair
    const verified = await sodium.verifyKeyPair({
      publicKey,
      secretKey,
    })
    assert(verified)
  }
  const signHash = async () => {
    const { secretKey } = keypair
    const signature = await sodium.signHash(testHash, secretKey)
    assert(signature)
    return signature
  }
  const verifySignature = (signature) => async () => {
    const { publicKey } = keypair
    const verified = await sodium.verifyHash(testHash, signature, publicKey)
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
    console.log(log.trim())

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
      const hash = sodium.objectHash(testString)
      const previous =
        'a46092d2aaf8df017b1ede7ef3a2d2a427eb23cc240bbf3687d69a1ba17f4a27'
      assert.equal(hash, previous)
      const different = sodium.objectHash('different string')
      assert.notEqual(hash, different)
    })
    test('should hash an object', () => {
      const testObject = { some: 'test', obj: 'etc' }
      const hash = sodium.objectHash(testObject)
      const previous =
        '70b467b32a6ea695555039bc52eba599305f2cbeaa7e4b59ced78aed3a07aebb'
      assert.equal(hash, previous, 'hash does not match the expected value')
      const different = sodium.objectHash({
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
      assert.equal(
        sodium.objectHash(testObject),
        sodium.objectHash(testObjectReOrder),
        'same object hashed to different values'
      )
    })
    test('undefined values for different keys result in different hashes', () => {
      const m = sodium.objectHash({ m: undefined })
      const n = sodium.objectHash({ n: undefined })
      assert(m !== n)
      const o = sodium.objectHash({ o: null })
      const p = sodium.objectHash({ p: null })
      assert(o !== p)
    })
  })

  describe('generateKeyPair', () => {
    test('same pair from same seed', async () => {
      const seed = '0123456789abcdef0123456789abcdef'
      const other = '70b467b32a6ea695555039bc52eba591'
      const kp1 = await sodium.generateKeyPair(seed)
      const kp2 = await sodium.generateKeyPair(seed)
      const kp3 = await sodium.generateKeyPair(other)
      const noSeed1 = await sodium.generateKeyPair()
      const noSeed2 = await sodium.generateKeyPair()

      assert.deepStrictEqual(kp1, kp2)
      assert.notStrictEqual(kp2, kp3)
      assert.notStrictEqual(kp3, noSeed1)
      assert.notStrictEqual(noSeed1, noSeed2)
    })
  })
  describe('sign|verify', () => {
    test('verifies signatures for previous signed objects', async () => {
      const hash = sodium.objectHash('test hash')
      const { publicKey, secretKey } = keypair
      const { signature } = await sodium.signHash(hash, secretKey)
      assert.equal(await sodium.verifyHash(hash, signature, publicKey), true)
      const tamp = 'a different hash'
      const isNotOk = await sodium.verifyHash(tamp, signature, publicKey)
      assert.equal(isNotOk, false)
      const isNotOkSync = sodium.verifyHashSync(tamp, signature, publicKey)
      assert.equal(isNotOkSync, false)
    })
    test('throws if hash not a secure hash', async () => {
      const notSecure = 'random'
      const secure = sodium.objectHash(notSecure)
      const { secretKey } = keypair

      await assert.rejects(sodium.signHash(notSecure, secretKey))
      assert.ok(await sodium.signHash(secure, secretKey))
    })
    test('caches already verified signatures', async () => {
      const { publicKey, secretKey } = await sodium.generateKeyPair()
      const { size } = sodium._verifiedSet
      const { signature } = await sodium.signHash(testHash, secretKey)
      assert.equal(sodium._verifiedSet.size, size)
      assert(!sodium.verifyHashSync(testHash, signature, publicKey))
      const verified = await sodium.verifyHash(testHash, signature, publicKey)
      assert(verified)
      assert.equal(sodium._verifiedSet.size, size + 1)
      assert(sodium.verifyHashSync(testHash, signature, publicKey))
    })
    test.todo('caches created signatures for instant verify')
    test.todo('alerts if asked to sign the same thing twice')
  })

  describe('verifyKeyPair()', () => {
    test('verifies a known good keypair', async () => {
      const { publicKey, secretKey } = keypair
      const isVerified = await sodium.verifyKeyPair({
        publicKey,
        secretKey,
      })
      assert.equal(isVerified, true)
    })
    test('returns false for a known bad keyPair', async () => {
      const isVerifiedKeyPair = await sodium.verifyKeyPair({
        publicKey: 'random public key',
        secretKey: 'random secret key',
      })
      assert.equal(isVerifiedKeyPair, false)
      const { secretKey } = await sodium.generateKeyPair()
      const { publicKey } = await sodium.generateKeyPair()
      const swapped = await sodium.verifyKeyPair({
        publicKey,
        secretKey,
      })
      assert.equal(swapped, false)
      assert.equal(sodium.verifyKeyPairSync(swapped), false)
    })
    test('caches already verified keypairs', async () => {
      const { size } = sodium._verifiedSet
      const keypair = await sodium.generateKeyPair()
      assert.equal(sodium._verifiedSet.size, size + 1)
      assert(sodium.verifyKeyPairSync(keypair))
    })
    test.todo('caches created keypairs for instant verify')
  })

  describe('nonce', () => {
    test('generate nonce', () => {
      const nonce = sodium.generateNonce()
      assert(nonce.length === 64 + 2)
    })
  })
})
