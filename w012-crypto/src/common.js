const nodeObjectHash = require('node-object-hash')({ coerce: false })
const secureRandom = require('secure-random')
const browserHash = require('object-hash')
const { v4 } = require('uuid')

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
let seed = ''
const generateNonce = () => {
  // TODO provide a seed when in test mode, for determinism
  // TODO move to tweetnacl random implementation
  let bytes
  if (seed) {
    bytes = Buffer.from(seed)
    // TODO increment the seed using the counter
    counter++
    return seed
  }
  // TODO test with actual randomness
  // TODO make the seed be uniform
  return v4()
}
const injectSeed = (_seed) => {
  counter = 0
  if (!_seed) {
    seed = _seed
    return
  }
  while (_seed.length < 32) {
    _seed += '0'
  }
  seed = _seed.substring(0, 32)
}

module.exports = { injectSeed, objectHash, generateNonce }
