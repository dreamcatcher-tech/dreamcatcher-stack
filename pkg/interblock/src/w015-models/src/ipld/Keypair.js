import assert from 'assert-fast'
import { PublicKey } from './PublicKey'
import crypto from 'libp2p-crypto'
import { fromString as from } from 'uint8arrays/from-string'
import { deepFreeze } from './utils'
const {
  secp256k1: { Secp256k1PrivateKey },
} = crypto.keys.supportedKeys

const CI = {
  pri: from('FkTM75NSp94cAgNkXCgVFQADDe2eNXi7qaCHMKtrcJCW', 'base58btc'),
  pub: from('puEKUvWNGow9H4HtyXKxEWoaERpZ9BzKV9jt2Tx8FBys', 'base58btc'),
}
let CI_PRIVATE_KEY

export class Keypair {
  static async generate(name) {
    assert.strictEqual(typeof name, 'string')
    const privateKey = await crypto.keys.generateKeyPair('secp256k1')
    return this.create(name, privateKey)
  }
  static createCI(name = 'CI') {
    assert.strictEqual(typeof name, 'string')
    if (!CI_PRIVATE_KEY) {
      CI_PRIVATE_KEY = new Secp256k1PrivateKey(CI.pri, CI.pub)
    }
    return this.create(name, CI_PRIVATE_KEY)
  }
  #privateKey
  static create(name, privateKey) {
    assert.strictEqual(typeof name, 'string')
    assert(privateKey instanceof Secp256k1PrivateKey)
    const keypair = new this()
    keypair.#privateKey = privateKey
    keypair.name = name
    keypair.publicKey = PublicKey.create(name, privateKey.public)
    deepFreeze(keypair)
    return keypair
  }
}
