const assert = require('assert')
const debug = require('debug')('interblock:models:keypair')
const crypto = require('../../../w012-crypto')
const { standardize } = require('../utils')
const { publicKeyModel } = require('./publicKeyModel')
const { integrityModel } = require('./integrityModel')
const { signatureModel } = require('./signatureModel')

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
      const { publicKey, secretKey } = instance
      const { signature: seal } = await crypto.signHash(hash, secretKey)
      const verified = await crypto.verifyHash(hash, seal, publicKey.key)
      assert(verified)
      assert(crypto.verifyHashSync(hash, seal, publicKey.key))
      const signature = { publicKey, integrity, seal }
      const model = signatureModel.clone(signature)
      debug(`sign complete`)
      return model
    }
    return { sign, getValidatorEntry }
  },
})

module.exports = { keypairModel }
