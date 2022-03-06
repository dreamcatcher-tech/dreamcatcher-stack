import { IpldStruct } from './IpldStruct'
import { toString } from 'uint8arrays/to-string'
import crypto from 'libp2p-crypto'
import assert from 'assert-fast'
const {
  secp256k1: { Secp256k1PublicKey },
} = crypto.keys.supportedKeys

export class PublicKey extends IpldStruct {
  static create(name, publicKey) {
    assert.strictEqual(typeof name, 'string')
    assert(publicKey instanceof Secp256k1PublicKey)
    return super.create({
      name,
      key: toString(publicKey.marshal(), 'base58btc'),
      algorithm: 'Secp256k1',
    })
  }
}
