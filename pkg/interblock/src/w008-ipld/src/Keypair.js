import assert from 'assert-fast'
import { peerIdFromKeys } from '@libp2p/peer-id'
import { PublicKey, Provenance } from '.'
import { keys } from '@libp2p/crypto'
import { fromString as from } from 'uint8arrays/from-string'
import { toString as to } from 'uint8arrays/to-string'
import { deepFreeze } from './utils'
const {
  secp256k1: { Secp256k1PrivateKey },
} = keys.supportedKeys

const CI = {
  pri: from('FkTM75NSp94cAgNkXCgVFQADDe2eNXi7qaCHMKtrcJCW', 'base58btc'),
  pub: from('puEKUvWNGow9H4HtyXKxEWoaERpZ9BzKV9jt2Tx8FBys', 'base58btc'),
}
let CI_PRIVATE_KEY

export class Keypair {
  static async generate(name) {
    const privateKey = await keys.generateKeyPair('secp256k1')
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
  #peerId
  static create(name, privateKey) {
    const msg = 'must supply a name for the key'
    assert.strictEqual(typeof name, 'string', msg)
    assert(name, msg)
    assert(privateKey instanceof Secp256k1PrivateKey)
    const keypair = new this()
    keypair.#privateKey = privateKey
    keypair.name = name
    keypair.publicKey = PublicKey.create(name, privateKey.public)
    deepFreeze(keypair)
    return keypair
  }
  export() {
    const name = this.name
    const privateKey = to(this.#privateKey.marshal(), 'base58btc')
    const publicKey = to(this.#privateKey.public.marshal(), 'base58btc')
    return { name, privateKey, publicKey }
  }
  static import({ name, privateKey, publicKey }) {
    const pri = from(privateKey, 'base58btc')
    const pub = from(publicKey, 'base58btc')
    const key = new Secp256k1PrivateKey(pri, pub)
    return this.create(name, key)
  }
  async generatePeerId() {
    if (!this.#peerId) {
      const pub = this.#privateKey.public.bytes
      const pri = this.#privateKey.bytes
      this.#peerId = await peerIdFromKeys(pub, pri)
    }
    return this.#peerId
  }
  async sign(provenance) {
    assert(provenance instanceof Provenance)
    assert(!provenance.isModified())
    const { cid } = provenance
    const bytes = await this.#privateKey.sign(cid.bytes)
    const signature = to(bytes, 'base36upper')
    return signature
  }
}
