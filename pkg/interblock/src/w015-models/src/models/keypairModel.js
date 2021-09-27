import { assert } from 'chai/index.mjs'
import * as crypto from '../../../w012-crypto'
import { standardize } from '../modelUtils'
import { publicKeyModel } from './publicKeyModel'
import { integrityModel } from './integrityModel'
import { signatureModel } from './signatureModel'
import Debug from 'debug'
const debug = Debug('interblock:models:keypair')
const keypairModel = standardize({
  schema: {
    title: 'Keypair',
    // description: 'public private key pair',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'publicKey', 'secretKey'],
    properties: {
      name: { type: 'string' },
      publicKey: publicKeyModel.schema,
      secretKey: {
        type: 'string',
      },
    },
  },
  create(name = 'CI', keypairRaw = crypto.ciKeypair, algorithm) {
    assert.strictEqual(typeof name, 'string')
    // TODO assert keypairRaw format
    algorithm = algorithm || 'noble-secp256k1'
    assert.strictEqual(typeof algorithm, 'string')
    if (name !== 'CI' && keypairRaw === crypto.ciKeypair) {
      keypairRaw = crypto.generateKeyPair()
    }
    const publicKey = publicKeyModel.clone({
      key: keypairRaw.publicKey,
      algorithm,
    })
    const { secretKey } = keypairRaw
    return keypairModel.clone({
      name,
      publicKey,
      secretKey,
    })
  },
  logicize(instance) {
    const publicKey = instance.publicKey.key
    const { secretKey } = instance
    const keypairRaw = { publicKey, secretKey }
    if (!crypto.verifyKeyPairSync(keypairRaw)) {
      throw new Error('Not a valid keypair - refusing to instantiate')
    }
    const getValidatorEntry = () => ({
      [instance.name]: instance.publicKey,
    })
    return { getValidatorEntry }
  },
})

export { keypairModel }
