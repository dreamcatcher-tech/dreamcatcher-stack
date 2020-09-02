const assert = require('assert')
const debug = require('debug')('interblock:crypto:sodium')
const {
  SodiumPlus,
  Ed25519PublicKey,
  Ed25519SecretKey,
} = require('sodium-plus')
const { objectHash, generateNonce } = require('./common')
const _ciKeypair = {
  publicKey: 'I7xUkSwebpLEqGglyGfif/3FVb/71CRPF6Jqv//ull0=',
  secretKey:
    'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYjvFSRLB5uksSoaCXIZ+J//cVVv/vUJE8Xomq//+6WXQ==',
}
Object.freeze(_ciKeypair)
const _verifiedSet = new Set([
  `${_ciKeypair.publicKey}_${_ciKeypair.secretKey}`,
])

let _sodiumPromise
const sodiumLoader = () => {
  // apiGateway loads module multiple times - only instantiate when called directly.
  if (!_sodiumPromise) {
    _sodiumPromise = SodiumPlus.auto()
  }
  return _sodiumPromise
}

const _hashTemplate = objectHash('template')

const generateKeyPair = async (seed) => {
  const sodium = await sodiumLoader()
  seed = seed || (await sodium.randombytes_buf(32))
  const keypairRaw = await sodium.crypto_sign_seed_keypair(seed)
  const secret = await sodium.crypto_sign_secretkey(keypairRaw)
  const public = await sodium.crypto_sign_publickey(keypairRaw)
  const keypair = {
    publicKey: public.toString('base64'),
    secretKey: secret.toString('base64'),
  }
  const { publicKey, secretKey } = keypair
  const mapKey = `${publicKey}_${secretKey}`
  _verifiedSet.add(mapKey)
  return keypair
}

const verifyKeyPairSync = ({ publicKey, secretKey }) =>
  _verifiedSet.has(`${publicKey}_${secretKey}`)

const verifyKeyPair = async ({ publicKey, secretKey }) => {
  assert.equal(typeof publicKey, 'string')
  assert.equal(typeof secretKey, 'string')
  const mapKey = `${publicKey}_${secretKey}`
  try {
    const { signature } = await signHash(_hashTemplate, secretKey)
    const verified = await verifyHash(_hashTemplate, signature, publicKey)
    if (verified) {
      _verifiedSet.add(mapKey)
    }
  } catch (e) {}
  return _verifiedSet.has(mapKey)
}

const signHash = async (messageHash, secretKey) => {
  assert.equal(messageHash.length, _hashTemplate.length, `use objectHash()`)
  const secret = Ed25519SecretKey.from(secretKey, 'base64')
  const sodium = await sodiumLoader()
  const sig = await sodium.crypto_sign_detached(messageHash, secret)
  const signature = sig.toString('base64')
  return { messageHash, signature }
}

const verifyHashSync = (messageHash, signature, publicKey) => {
  const key = `${messageHash}_${signature}_${publicKey}`
  const isVerified = _verifiedSet.has(key)
  return isVerified
}

const verifyHash = async (messageHash, signature, publicKey) => {
  const sig = Buffer.from(signature, 'base64')
  const public = Ed25519PublicKey.from(publicKey, 'base64')
  const sodium = await sodiumLoader()
  const ver = await sodium.crypto_sign_verify_detached(messageHash, public, sig)
  const key = `${messageHash}_${signature}_${publicKey}`
  if (ver) {
    _verifiedSet.add(key)
  } else {
    debug(`verifyHash failed`)
  }
  return ver
}

const testMode = () => {
  debug(`no testmode in sodium`)
}

const _getBackend = async () => {
  const sodium = await sodiumLoader()
  return sodium.getBackendName()
}

module.exports = {
  objectHash,
  signHash,
  verifyHash,
  verifyHashSync,
  generateKeyPair,
  verifyKeyPair,
  verifyKeyPairSync,
  generateNonce,
  testMode,
  _ciKeypair,
  _verifiedSet,
  _getBackend,
}
