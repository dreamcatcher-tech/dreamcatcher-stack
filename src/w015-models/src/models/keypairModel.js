import assert from 'assert'
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
    description: 'public private key pair',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'publicKey', 'secretKey', 'algorithm'],
    properties: {
      name: { type: 'string' },
      publicKey: publicKeyModel.schema,
      secretKey: {
        type: 'string',
      },
      algorithm: {
        enum: ['tweetnacl', 'sodium'],
      },
    },
  },
  create(name = 'CI', keypairRaw = crypto.ciKeypair) {
    assert.strictEqual(typeof name, 'string')
    const publicKey = publicKeyModel.clone({
      key: keypairRaw.publicKey,
      algorithm: 'sodium',
    })
    const { secretKey } = keypairRaw
    return keypairModel.clone({
      name,
      publicKey,
      secretKey,
      algorithm: 'sodium',
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
    const sign = async (integrity) => {
      debug(`sign`)
      if (!integrity) {
        throw new Error('Refusing to sign undefined integrity')
      }
      integrity = integrityModel.clone(integrity)
      const { hash } = integrity
      const { secretKey } = instance
      const { signature: seal } = await crypto.signHash(
        hash,
        secretKey,
        publicKey
      )
      const verified = await crypto.verifyHash(hash, seal, publicKey)
      assert(verified)
      assert(crypto.verifyHashSync(hash, seal, publicKey))
      // TODO find a cleaner way to use publicKey objects, and publicKey strings in crypto
      const signature = { publicKey: instance.publicKey, integrity, seal }
      const model = signatureModel.clone(signature)
      debug(`sign complete`)
      return model
    }
    return { sign, getValidatorEntry }
  },
})

export { keypairModel }
