import assert from 'assert-fast'
import levelup from 'levelup'
import memdown from 'memdown'
import { cryptoCacher, keypairModel } from '../../../w015-models'
import { signatureProducer } from '../../../w016-producers'
import { dbFactory } from './consistencyFactory'
import * as crypto from '../../../w012-crypto'
import Debug from 'debug'
const debug = Debug('interblock:services:crypto')

// TODO reuse the same key if CI for deterministic blocks
const cryptoSourceFactory = (leveldb, keyname = 'CI') => {
  leveldb = leveldb || levelup(memdown())
  const db = dbFactory(leveldb)
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
    const current = await db.scanKeypair()
    if (current) {
      _keypair = current
    } else {
      const keypairRaw =
        keyname === 'CI' ? crypto.ciKeypair : crypto.generateKeyPair()
      const keypairAttempt = keypairModel.create(keyname, keypairRaw)
      await db.putKeypair(keypairAttempt)
      // TODO rescan to ensure parallel threads have the same key
      const retrieved = await db.scanKeypair()
      if (!retrieved) {
        throw new Error(`cannot store keypair`)
      }
      _keypair = retrieved
      if (!_keypair.equals(keypairAttempt)) {
        console.error(`collision avoided for: `, keyname)
      }
    }
    return _keypair
  }

  return { sign, getValidatorEntry }
}

const cryptoFactory = (leveldb, keyname = 'CI') => {
  const cryptoSource = cryptoSourceFactory(leveldb, keyname)
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
