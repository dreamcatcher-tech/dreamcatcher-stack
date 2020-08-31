const nodeObjectHash = require('node-object-hash')({ coerce: false })
const secureRandom = require('secure-random')
const pad = require('pad/dist/pad.umd')
const browserHash = require('object-hash')

// TODO see if sodium hashing performs better
// use stable stringify for equality, and serialize, then compute hash if requested
// model based stringify, only if hash requested, use hash of this string
const objectHash = (obj) => {
  if (typeof process === 'undefined') {
    // TODO move to https://github.com/crypto-browserify/crypto-browserify
    const string = nodeObjectHash.sort(obj)
    return browserHash(string, { algorithm: 'sha256', encoding: 'hex' })
  }
  return nodeObjectHash.hash(obj)
}

let counter = 0
const generateNonce = (testMode) => {
  // TODO provide a seed when in test mode, for determinism
  // TODO move to tweetnacl random implementation
  if (testMode) {
    const prefix = pad(9, counter, '0')
    counter++
    const nonce = `0x${prefix}c6ee4f60107cc496d1dcacd642be4011c3b4fe09668f08f01f41cc9`
    return nonce
  }
  const bytes = secureRandom(32, { type: 'Array' })
  const hex = bytes
    .map((byte) => {
      return ('0' + (byte & 0xff).toString(16)).slice(-2)
    })
    .join('')
  return '0x' + hex
}

module.exports = { objectHash, generateNonce }
