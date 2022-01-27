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
    let isVerified = false
    if (name === 'CI') {
      if (keypairRaw && keypairRaw !== crypto.ciKeypair) {
        throw new Error('CI name is reserved for the CI keypair')
      }
      keypairRaw = crypto.ciKeypair
      isVerified = true
    }
    let publicKey = ciPublicKey
    if (name !== 'CI') {
      algorithm = algorithm || 'noble-secp256k1'
      if (!keypairRaw) {
        assert.strictEqual(algorithm, 'noble-secp256k1', `wrong algorithm`)
        isVerified = true
        keypairRaw = crypto.generateKeyPair()
      }
      assert.strictEqual(typeof algorithm, 'string')
      const params = { key: keypairRaw.publicKey, algorithm }
      publicKey = PublicKey.create(params)
    }
    const { secretKey } = keypairRaw
    const keypair = super.create({ name, publicKey, secretKey })
    keypair.#isVerified = isVerified
    return keypair
  }
  #isVerified = false
  async verify() {
    const publicKey = this.publicKey.key
    const { secretKey } = this
    const keypairRaw = { publicKey, secretKey }
    const isVerified = await crypto.verifyKeyPair(keypairRaw)
    if (!isVerified) {
      throw new Error('Not a valid keypair - refusing to instantiate')
    }
    this.#isVerified = true
  }
  assertIsVerified() {
    if (!this.#isVerified) {
      throw new Error('Keypair is not verified')
    }
  }
  getValidatorEntry() {
    return { [this.name]: this.publicKey }
  }
}
