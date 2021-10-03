import assert from 'assert-fast'
import { cryptoCacher, keypairModel } from '../../../w015-models'
import { signatureProducer } from '../../../w016-producers'
import { ramDynamoDbFactory, dbFactory } from './consistencyFactory'
import * as crypto from '../../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:services:crypto')
const { cacheVerifyKeypair } = cryptoCacher

// TODO reuse the same key if CI for deterministic blocks
const cryptoSourceFactory = (dynamoDb, keyname = 'CI') => {
  dynamoDb = dynamoDb || ramDynamoDbFactory()
  const db = dbFactory(dynamoDb)
  assert(typeof keyname === 'string')
  const sign = async (integrity) => {
    debug(`sign`)
    const keypair = await _getKeypair()
    return signatureProducer.sign(integrity, keypair)
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

const toCryptoFunctions = (queue) => ({
  sign: (payload) => queue.push({ type: 'SIGN', payload }),
  getValidatorEntry: () => queue.push({ type: 'VALIDATOR' }),
})

export { cryptoFactory, toCryptoFunctions, crypto }
