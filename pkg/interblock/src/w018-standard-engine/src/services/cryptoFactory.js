import assert from 'assert-fast'
import { Keypair } from '../../../w015-models'
import { signatureProducer } from '../../../w016-producers'
import { rxdbCrypto } from './rxdbCrypto'
import * as crypto from '../../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:services:crypto')

// TODO reuse the same key if CI for deterministic blocks
const cryptoSourceFactory = (cryptoDb, keyname = 'CI') => {
  const db = rxdbCrypto(cryptoDb)
  assert(typeof keyname === 'string')
  const sign = async (integrity) => {
    const keypair = await _getKeypair()
    debug(`sign as:`, keypair.name)
    return signatureProducer.sign(integrity, keypair)
  }

  const getValidatorEntry = async () => {
    const keypair = await _getKeypair()
    debug(`getValidatorEntry as:`, keypair.name)
    return keypair.getValidatorEntry()
  }

  let _keypair
  const _getKeypair = async () => {
    if (_keypair) {
      return _keypair
    }
    const current = await db.scanKeypair()
    if (current) {
      _keypair = current
    } else {
      // TODO use db consistency methods to avoid this dance
      const keypairRaw =
        keyname === 'CI' ? crypto.ciKeypair : crypto.generateKeyPair()
      const keypairAttempt = Keypair.create(keyname, keypairRaw)
      await db.putKeypair(keypairAttempt)
      // TODO rescan to ensure parallel threads have the same key
      const retrieved = await db.scanKeypair()
      if (!retrieved) {
        throw new Error(`cannot store keypair`)
      }
      _keypair = retrieved
      if (!_keypair.deepEquals(keypairAttempt)) {
        console.error(`collision avoided for: `, keyname)
      }
    }
    return _keypair
  }

  return { sign, getValidatorEntry }
}

const cryptoFactory = (cryptoDb, keyname = 'CI') => {
  const cryptoSource = cryptoSourceFactory(cryptoDb, keyname)
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
