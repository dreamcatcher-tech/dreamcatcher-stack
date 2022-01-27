import { isRxDatabase } from 'rxdb'
import assert from 'assert-fast'
import Debug from 'debug'
import { Keypair } from '../../../w015-models'
const debug = Debug('interblock:services:crypto:db')

export const rxdbCrypto = (rxdbPromise) => {
  assert(rxdbPromise, `No crypto database provided`)
  let db
  const settleRxdb = async () => {
    if (!db) {
      const rxdb = await rxdbPromise
      assert(isRxDatabase(rxdb))
      if (!rxdb.crypto) {
        await rxdb.addCollections({
          crypto: {
            schema: {
              version: 0,
              primaryKey: 'key',
              type: 'object',
              properties: {
                key: { type: 'string', final: true },
                value: { type: 'array', final: true },
              },
            },
          },
        })
      }
      db = rxdb.crypto
    }
  }
  const scanKeypair = async () => {
    // TODO split out crypto functions into own file
    await settleRxdb()
    debug('scanKeypair start')
    const $gte = `crypto/`
    const $lte = `crypto/~`
    const firstDocument = await db
      .findOne({ selector: { key: { $and: [{ $gte }, { $lte }] } } })
      .exec()
    if (firstDocument) {
      const { value } = firstDocument
      assert(Array.isArray(value))
      const keypair = Keypair.restore(value)
      await keypair.verify()
      debug('scanKeypair end')
      return keypair
    }
    debug(`no keypair found`)
  }

  const putKeypair = async (keypair) => {
    await settleRxdb()
    debug(`putKeypair`)
    assert(keypair instanceof Keypair)
    const key = `crypto/${keypair.publicKey.key}`
    const value = keypair.toArray()
    await db.insert({ key, value })
  }
  return { scanKeypair, putKeypair }
}
