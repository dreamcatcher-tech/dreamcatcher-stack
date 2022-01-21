import assert from 'assert-fast'
import leftPad from 'pad-left'
import { isRxDatabase } from 'rxdb'
import {
  Block,
  Interblock,
  Keypair,
  TxReply,
  TxRequest,
} from '../../../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:consistency:db')
const types = ['blocks', 'interblocks', 'piercings', 'pool']
const pad = (height) => {
  assert(Number.isInteger(height))
  // TODO handle bigger than 32bit heights
  return leftPad(height, 10, '0')
}

let isCacheDisabled = false
class Cache {
  #debug = Debug('interblock:consistency:db:cache')
  #cache = new Map()
  #total = 0
  #limitMB = 100
  constructor(limit, type) {
    if (type) {
      this.#debug = this.#debug.extend(type)
    }
    assert(Number.isInteger(limit))
    assert(limit >= 0)
    this.#limitMB = limit
  }
  static disable() {
    debug(`disabling cache`)
    isCacheDisabled = true
  }
  put(key, model) {
    if (isCacheDisabled) {
      debug(`cache disabled`)
      return
    }
    assert.strictEqual(typeof key, 'string')
    assert.strictEqual(typeof model, 'object')
    assert(!this.#cache.has(key))
    const size = 1024 // TODO
    const value = { model, size }
    this.#cache.set(key, value)
    this.#total += size
    if (this.#total > this.#limitMB * 1024 * 1024) {
      this.#debug(`shrinking cache`)
      const originalCacheSize = this.#total
      const entries = this.#cache.entries()
      while (this.#total > this.#limitMB * 1024 * 1024) {
        const [key, value] = entries.next().value
        this.#total -= value.size
        this.#cache.delete(key)
      }
      this.#debug('cache size was:', originalCacheSize, 'now:', this.#total)
    }
  }
  get(key) {
    assert.strictEqual(typeof key, 'string')
    const value = this.#cache.get(key)
    if (value) {
      this.#cache.delete(key)
      this.#cache.set(key, value)
      return value.model
    }
    debug(`cache miss`, key)
  }
  del(key) {
    assert.strictEqual(typeof key, 'string')
    if (!this.#cache.has(key)) {
      return
    }
    const { size } = this.#cache.get(key)
    this.#total -= size
    this.#cache.delete(key)
  }
}

const dbFactory = (rxdbPromise) => {
  assert(rxdbPromise, `must supply rxdb`)
  const cacheLimitMb = 100
  const cache = new Cache(cacheLimitMb)
  // TODO make separate caches for interblocks, blocks, piercings

  let db
  const settleRxdb = async () => {
    if (!db) {
      const rxdb = await rxdbPromise
      assert(isRxDatabase(rxdb))
      if (!rxdb.blockchains) {
        await rxdb.addCollections({
          blockchains: {
            schema: {
              version: 0,
              primaryKey: 'key',
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'array' },
              },
            },
          },
        })
      }
      db = rxdb.blockchains
    }
  }

  const getBlock = async (chainId, height) => {
    await settleRxdb()
    assert.strictEqual(typeof chainId, 'string')
    assert(Number.isInteger(height))
    assert(height >= 0)
    debug(`getBlock`, chainId, height)
    const $gte = `${chainId}/blocks/${pad(height)}`
    const $lte = $gte + '~'
    const doc = await db
      .findOne({ selector: { key: { $and: [{ $gte }, { $lte }] } } })
      .exec()
    // TODO check hash matches
    // TODO check that no other block exists at this height
    if (!doc) {
      return
    }
    let block = cache.get(doc.key)
    if (!block) {
      const { value } = doc
      assert(Array.isArray(value))
      block = Block.restore(value)
    }
    debug(`getBlock height: `, block.getHeight())
    return block
  }
  const putPool = async (interblock) => {
    await settleRxdb()
    assert(interblock instanceof Interblock)
    const targetChainId = interblock.getTargetAddress().getChainId()
    const chainId = interblock.getChainId()
    const { height } = interblock.provenance
    const hash = interblock.hashString()
    const key = `${targetChainId}/pool/${chainId}_${pad(height)}_${hash}`
    const value = interblock.toArray()
    await db.insert({ key, value })
    cache.put(key, interblock)
  }
  const putBlock = async (block) => {
    await settleRxdb()
    const chainId = block.getChainId()
    const height = block.getHeight()
    const hash = block.hashString()
    const value = block.toArray()
    const key = `${chainId}/blocks/${pad(height)}_${hash}`
    debug(`putBlock`, key)
    await db.insert({ key, value })
    cache.put(key, block)
    debug(`putBlock`, chainId.substring(0, 9), height)
  }
  const queryLatest = async (chainId) => {
    await settleRxdb()
    debug(`queryLatest %o`, chainId.substring(0, 9))
    const $gte = `${chainId}/blocks/`
    const $lte = `${chainId}/blocks/~`

    const rxDocument = await db
      .findOne({
        selector: { key: { $and: [{ $gte }, { $lte }] } },
        sort: [{ key: 'desc' }],
      })
      .exec()
    if (!rxDocument) {
      debug(`queryLatest nothing found`)
      return
    }
    let block = cache.get(rxDocument.key)
    if (!block) {
      debug(`findOne`, rxDocument.key)
      const doc = await db.findOne({ selector: { key: rxDocument.key } }).exec()
      block = Block.restore(doc.value)
    }
    debug(`queryLatest height: `, block.getHeight())
    return block
  }

  const putPierceReply = async (chainId, txReply) => {
    await settleRxdb()
    assert(txReply instanceof TxReply)
    debug(`putPierceReply`)
    const key = `${chainId}/piercings/rep_${txReply.hashString()}`
    // TODO get order by loosely trying to add the current tip count + 1
    // doesn't matter if it collides
    const value = txReply.toArray()
    await db.insert({ key, value })
    cache.put(key, txReply)
  }
  const putPierceRequest = async (chainId, txRequest) => {
    await settleRxdb()
    assert(txRequest instanceof TxRequest)
    debug(`putPierceRequest`, txRequest.hashString().substring(0, 9))
    const key = `${chainId}/piercings/req_${txRequest.hashString()}`
    // TODO get order by loosely trying to add the current tip count + 1
    // doesn't matter if it collides
    const value = txRequest.toArray()
    await db.insert({ key, value })
    cache.put(key, txRequest)
  }

  const delPool = async (chainId, interblocks) => {
    await settleRxdb()
    debug(`delPool`)
    // TODO check interblock was included in the block
    assert(Array.isArray(interblocks))

    const keys = []
    for (const interblock of interblocks) {
      const ibChainId = interblock.getChainId()
      const { height } = interblock.provenance
      const hash = interblock.hashString()
      const key = `${chainId}/pool/${ibChainId}_${pad(height)}_${hash}`
      keys.push(key)
    }
    const results = await db.bulkRemove(keys)
    assert(!results.error.length, results.error)
    for (const key of keys) {
      cache.del(key)
    }
    debug(`delPool complete for %o keys`, keys.length)
  }

  const delPierce = async (chainId, piercings) => {
    await settleRxdb()
    const { replies, requests } = piercings
    assert(Array.isArray(replies))
    assert(Array.isArray(requests))
    const keys = []
    for (const reply of replies) {
      const key = `${chainId}/piercings/rep_${reply.hashString()}`
      keys.push(key)
    }
    for (const request of requests) {
      const key = `${chainId}/piercings/req_${request.hashString()}`
      keys.push(key)
    }
    const results = await db.bulkRemove(keys)
    assert(!results.error.length, results.error)
    for (const key of keys) {
      cache.del(key)
    }
    debug(`delPierce complete for %o replies`, replies.length)
    debug(`delPierce complete for %o requests`, requests.length)
  }

  const querySockets = (chainId) => {
    /**
     * Sockets map validator public keys to websocket ids.
     * They are determined by looking up the turnover interblocks for a channel
     * then looking up the mapping from validators to sockets.
     * May enhance by doing an index so can do chainId to socket as well.
     * But this might be stored in actual chains.
     */
    return []
  }

  const queryPool = async (chainId) => {
    await settleRxdb()
    debug(`queryPool`, chainId.substring(0, 9))
    const $gte = `${chainId}/pool/`
    const $lte = `${chainId}/pool/~`
    const rxDocuments = await db
      .find({ selector: { key: { $and: [{ $gte }, { $lte }] } } })
      .exec()
    const keys = rxDocuments.map((rxDocument) => rxDocument.key)
    const interblocks = []
    const uncachedKeys = keys.filter((key) => {
      const cached = cache.get(key)
      if (!cached) {
        return true
      }
      interblocks.push(cached)
    })
    debug(`getMany`, uncachedKeys.length)
    const docs = await db.findByIds(uncachedKeys)
    debug(`getMany done`)

    for (const doc of docs) {
      const interblock = Interblock.restore(doc.value)
      interblocks.push(interblock)
    }
    debug(`queryPool count:`, interblocks.length)
    return interblocks
  }

  const queryPiercings = async (chainId) => {
    assert.strictEqual(typeof chainId, 'string')
    await settleRxdb()
    debug(`queryPiercings`, chainId.substring(0, 9))
    const $gte = `${chainId}/piercings/`
    const $lte = `${chainId}/piercings/~`
    const requests = []
    const replies = []
    // TODO handle timestamps on piercings
    const rxDocuments = await db
      .find({ selector: { key: { $and: [{ $gte }, { $lte }] } } })
      .exec()
    for (const doc of rxDocuments) {
      const { key } = doc
      let tx = cache.get(key)
      if (key.startsWith($gte + `rep_`)) {
        tx = tx || TxReply.restore(doc.value)
        assert(tx instanceof TxReply)
        replies.push(tx)
      } else {
        tx = tx || TxRequest.restore(doc.value)
        assert(key.startsWith($gte + `req_`))
        assert(tx instanceof TxRequest)
        requests.push(tx)
      }
    }
    debug(`queryPiercings replies: %o`, replies.length)
    debug(`queryPiercings requests: %o`, requests.length)
    return { replies, requests }
  }

  const scanBaseChainId = async () => {
    await settleRxdb()
    debug('scanBaseChainId start')
    const firstDocument = await db.findOne().exec()
    if (firstDocument) {
      const { key } = firstDocument
      const [baseChainId] = key.split('/')
      debug('scanBaseChainId end')
      return baseChainId
    }
  }

  return {
    putPool,
    putBlock,

    delPool,

    getBlock,

    querySockets,
    queryLatest,
    queryPool,

    scanBaseChainId,

    putPierceReply,
    putPierceRequest,
    queryPiercings,
    delPierce,
  }
}

export { dbFactory, Cache }
