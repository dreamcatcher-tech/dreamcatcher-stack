const debug = require('debug')('interblock:services:crypto')
const assert = require('assert')
const {
  cryptoCacher,
  keypairModel,
  integrityModel,
} = require('../../../w015-models')
const { ramDynamoDbFactory, dbFactory } = require('./consistencyFactory')
const crypto = require('../../../w012-crypto')
const { cacheVerifyKeypair } = cryptoCacher

const cryptoSourceFactory = (dynamoDb, keyname = 'CI') => {
  dynamoDb = dynamoDb || ramDynamoDbFactory()
  const db = dbFactory(dynamoDb)
  assert(typeof keyname === 'string')
  const sign = async (integrity) => {
    assert(integrityModel.isModel(integrity))
    const keypair = await _getKeypair()
    return keypair.sign(integrity)
  }

  const getValidatorEntry = async () => {
    const keypair = await _getKeypair()
    return keypair.getValidatorEntry()
  }

  let _keypair
  const _getKeypair = async () => {
    if (_keypair) {
      return _keypair
    }
    const previous = await db.scanKeypair()
    if (previous) {
      const previousObj = JSON.parse(previous.keypairJson)
      await cacheVerifyKeypair(previousObj)
      _keypair = keypairModel.clone(previousObj)
    } else {
      const keypairRaw = await crypto.generateKeyPair()
      const keypairAttempt = keypairModel.create(keyname, keypairRaw)
      const keypairJson = keypairAttempt.serialize()
      await db.putKeypair({ keyname, keypairJson })
      // rescan to ensure parallel threads have the same key
      const { keypairJson: retrieved } = await db.scanKeypair()
      if (!retrieved) {
        throw new Error(`cannot store keypair`)
      }
      const retrievedObj = JSON.parse(retrieved)
      await cacheVerifyKeypair(retrievedObj)
      _keypair = keypairModel.clone(retrievedObj)
      if (!_keypair.equals(keypairAttempt)) {
        debug(`collision avoided for: `, keyname)
      }
    }
    return _keypair
  }

  return { sign, getValidatorEntry }
}

const cryptoFactory = (dynamoDb, keyname = 'CI') => {
  const cryptoSource = cryptoSourceFactory(dynamoDb, keyname)
  const cryptoProcessor = async (action) => {
    debug(`crypto: ${action.type}`)
    switch (action.type) {
      case 'SIGN':
        return cryptoSource.sign(action.payload)
      case 'VALIDATOR':
        return cryptoSource.getValidatorEntry()
      default:
        throw new Error(`Unknown crypto action type: ${action.type}`)
    }
  }
  return cryptoProcessor
}

const toFunctions = (queue) => ({
  sign: (payload) => queue.push({ type: 'SIGN', payload }),
  getValidatorEntry: () => queue.push({ type: 'VALIDATOR' }),
})

module.exports = { cryptoFactory, toFunctions }
