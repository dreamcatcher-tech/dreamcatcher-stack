import assert from 'assert-fast'
import * as crypto from '../../../w012-crypto'
import { publicKeySchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import { PublicKey } from '.'
const schema = {
  title: 'Keypair',
  description: 'public private key pair',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'publicKey', 'secretKey'],
  properties: {
    name: { type: 'string' },
    publicKey: publicKeySchema,
    secretKey: {
      type: 'string', // TODO regex check based on algo in publicKey
    },
  },
}
const ciPublicKey = PublicKey.ci()
export class Keypair extends mixin(schema) {
  static create(name = 'CI', keypairRaw, algorithm) {
    assert.strictEqual(typeof name, 'string')
    // TODO assert keypairRaw format
    if (name !== 'CI' && keypairRaw === crypto.ciKeypair) {
      throw Error('using the CI keypair must use the name "CI"')
    }
    if (name === 'CI') {
      if (keypairRaw && keypairRaw !== crypto.ciKeypair) {
        throw new Error('CI name is reserved for the CI keypair')
      }
      keypairRaw = crypto.ciKeypair
    }
    let publicKey = ciPublicKey
    if (name !== 'CI') {
      keypairRaw = keypairRaw || crypto.generateKeyPair()
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
