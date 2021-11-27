import assert from 'assert-fast'
import * as crypto from '../../../w012-crypto'
import { keypairSchema } from '../schemas/privateSchemas'
import { mixin } from './MapFactory'
import { PublicKey } from '.'

const ciPublicKey = PublicKey.ci()
export class Keypair extends mixin(keypairSchema) {
  static create(name = 'CI', keypairRaw = crypto.ciKeypair, algorithm) {
    assert.strictEqual(typeof name, 'string')
    // TODO assert keypairRaw format
    if (name !== 'CI' && keypairRaw === crypto.ciKeypair) {
      throw Error('using the CI keypair must use the name "CI"')
    }
    if (name === 'CI' && keypairRaw !== crypto.ciKeypair) {
      throw new Error('CI name is reserved for the CI keypair')
    }
    let publicKey = ciPublicKey
    if (name !== 'CI') {
      algorithm = algorithm || 'noble-secp256k1'
      assert.strictEqual(typeof algorithm, 'string')
      const params = { key: keypairRaw.publicKey, algorithm }
      publicKey = PublicKey.create(params)
    }
    const { secretKey } = keypairRaw
    const keypair = super.create({ name, publicKey, secretKey })
    return keypair
  }
  static async verify(keypairRaw) {
    // TODO run the async verify check in crypto, so that the sync
    // check can be performed during restore
  }
  assertLogic() {
    const publicKey = this.publicKey.key
    const { secretKey } = this
    const keypairRaw = { publicKey, secretKey }
    if (!crypto.verifyKeyPairSync(keypairRaw)) {
      throw new Error('Not a valid keypair - refusing to instantiate')
    }
  }
  getValidatorEntry() {
    return { [this.name]: this.publicKey }
  }
}
