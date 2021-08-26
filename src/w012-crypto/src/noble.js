import * as secp from 'noble-secp256k1'
import { Buffer } from 'buffer'
import { assert } from 'chai/index.mjs'
import Debug from 'debug'

const debug = Debug('interblock:crypto:noble')

const ciKeypair = {
  publicKey:
    'BCA2YUZVUIJ9Gfq4uL8HISMRplPsJ0pa6WrXNBpiocDWgzG1ro9QPLgjdi+jV9VziCBMshzPJoS1rYqe2Q06mdg=',
  secretKey: 'kO9gSGi5lxnlTuoN57TLZRG5Kv69yjouulyFbv/7PkQ=',
}
const pierceKeypair = {
  publicKey:
    'BKsCsITo1NVe3AZ7YOpnZdHqVcSLF0OSwGN8zjfPu0c0aicbBSVn/eDY44wcn88UziiJ6Yt7aNiW8ezU7Ppm/M8=',
  secretKey: '8I6hJieiz4fcfLIpF0GvHFht1oxmcvIpKEfLRaVJmfk=',
}
const _verifiedSet = new Set([
  `${ciKeypair.publicKey}_${ciKeypair.secretKey}`, // TODO use hashes, to obscure in memory
  `${pierceKeypair.publicKey}_${pierceKeypair.secretKey}`,
])

const _hashTemplate =
  'c90bda127af83fdfef28785fd3ca5689d9d864e8b676f0ba62f8d3686e27554f'

const generateKeyPair = () => {
  const secretKeyRaw = secp.utils.randomPrivateKey()
  const secretKey = Buffer.from(secretKeyRaw).toString('base64') // TODO use base58 encoder from noble
  const publicKeyRaw = secp.getPublicKey(secretKeyRaw)
  const publicKey = Buffer.from(publicKeyRaw).toString('base64')
  const mapKey = `${publicKey}_${secretKey}`
  _verifiedSet.add(mapKey)
  const keypair = { publicKey, secretKey }
  return keypair
}

// TODO remove the awkwardness from this being async
const verifyKeyPairSync = ({ publicKey, secretKey }) =>
  _verifiedSet.has(`${publicKey}_${secretKey}`)

const verifyKeyPair = async ({ publicKey, secretKey }) => {
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(typeof secretKey, 'string')
  const mapKey = `${publicKey}_${secretKey}`
  try {
    const { signature } = await signHash(_hashTemplate, secretKey)
    const verified = verifyHash(_hashTemplate, signature, publicKey)
    if (verified) {
      _verifiedSet.add(mapKey)
    }
  } catch (e) {
    // key not found
  }
  return _verifiedSet.has(mapKey)
}

// TODO include or cache public key so can cache the sign operation
const signHash = async (messageHash, secretKey, publicKey) => {
  assert.strictEqual(typeof messageHash, 'string')
  assert.strictEqual(typeof secretKey, 'string')
  assert.strictEqual(typeof publicKey, 'string')
  assert.strictEqual(messageHash.length, _hashTemplate.length, `invalid hash`)
  // TODO check the format of the hash string
  const secret = Buffer.from(secretKey, 'base64').toString('hex')
  const signatureRaw = await secp.sign(messageHash, secret)
  const signature = Buffer.from(signatureRaw, 'hex').toString('base64')

  const key = `${messageHash}_${signature}_${publicKey}`
  _verifiedSet.add(key)

  return { messageHash, signature }
}

const verifyHashSync = (messageHash, signature, publicKey) => {
  const key = `${messageHash}_${signature}_${publicKey}`
  const isVerified = _verifiedSet.has(key)
  return isVerified
}

const verifyHash = (hash, signature, publicKey) => {
  // TODO assert formats and length of all args
  const signatureRaw = Uint8Array.from(Buffer.from(signature, 'base64'))
  const publicKeyRaw = Uint8Array.from(Buffer.from(publicKey, 'base64'))
  const hashRaw = Uint8Array.from(Buffer.from(hash, 'hex'))
  try {
    const isVerified = secp.verify(signatureRaw, hashRaw, publicKeyRaw)
    if (!isVerified) {
      return false
    }
    const key = `${hash}_${signature}_${publicKey}`
    _verifiedSet.add(key)
    return true
  } catch (e) {
    debug(`verifyHash failed`, hash, signature, publicKey)
    return false
  }
}

export {
  signHash,
  verifyHash,
  verifyHashSync,
  generateKeyPair,
  verifyKeyPair,
  verifyKeyPairSync,
  ciKeypair,
  pierceKeypair,
  _verifiedSet,
}
