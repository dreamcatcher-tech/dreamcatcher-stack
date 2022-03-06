import { PublicKey } from './PublicKey'
import { Keypair } from './Keypair'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Validators extends IpldStruct {
  static createCI() {
    const kp = Keypair.createCI()
    return this.create([kp.publicKey])
  }
  static create(publicKeys = [], quorumThreshold) {
    assert(Array.isArray(publicKeys))
    assert(publicKeys.length > 0)
    assert(publicKeys.every((v) => v instanceof PublicKey))
    if (!quorumThreshold) {
      quorumThreshold = Math.floor((2 * publicKeys.length) / 3) + 1
    }
    assert(Number.isInteger(quorumThreshold))
    assert(quorumThreshold > 0)

    return super.create({ publicKeys, quorumThreshold })
  }
  static classMap = {
    publicKeys: PublicKey,
  }
  assertLogic() {
    const keyset = new Set()
    for (const value of this.publicKeys) {
      assert(value instanceof PublicKey)
      if (keyset.has(value.key)) {
        throw new Error(`duplicate key ${value.name} ${value.key}`)
      }
      keyset.add(value.key)
    }
  }
}
