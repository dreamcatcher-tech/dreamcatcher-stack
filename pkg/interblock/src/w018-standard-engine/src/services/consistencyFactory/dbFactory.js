import assert from 'assert-fast'
import LevelUp from 'levelup'
import leftPad from 'pad-left'
import Debug from 'debug'
import {
  blockModel,
  interblockModel,
  keypairModel,
  txReplyModel,
  txRequestModel,
} from '../../../../w015-models'
const debug = Debug('interblock:consistency:db')
const types = ['blocks', 'interblocks', 'piercings', 'pool']
const pad = (height) => {
  assert(Number.isInteger(height))
  // TODO handle bigger than 32bit heights
  return leftPad(height, 10, '0')
}
const dbFactory = (leveldb) => {
  assert(leveldb instanceof LevelUp)
  assert(leveldb.isOperational())
  const _cache = new Map()
  const _latestCache = new Map()
  const cacheLimitMb = 100
  let cacheSize = 0
  const putCache = (key, object) => {
    assert(!_cache.has(key))
    _cache.set(key, object)
    cacheSize += object.serialize().length
    if (cacheSize > cacheLimitMb * 1024 * 1024) {
      const dbg = debug.extend('cache')
      dbg(`shrinking cache`)
      const originalCacheSize = cacheSize
      const entries = _cache.entries()
      while (cacheSize > cacheLimitMb * 1024 * 1024) {
        const [key, object] = entries.next().value
        cacheSize -= object.serialize().length
        _cache.delete(key)
      }
      dbg('cache size was:', originalCacheSize, 'now:', cacheSize)
    }
  }
  const getCache = (key) => {
    const obj = _cache.get(key)
    if (!obj) {
      debug(`cache miss`, key)
    }
    return obj
  }
  const delCache = (key) => _cache.delete(key)

  const getBlock = async (chainId, height) => {
    assert.strictEqual(typeof chainId, 'string')
    assert(Number.isInteger(height))
    assert(height >= 0)
    const gte = `${chainId}/blocks/${pad(height)}`
    let key
    for await (const [keyBuffer] of leveldb.iterator({
      limit: 1,
      keys: true,
      values: false,
      gte,
      lte: gte + '~',
    })) {
      // TODO check hash matches
      // TODO check that no other block exists at this height
      key = keyBuffer.toString()
    }
    if (!key) {
      return
    }
    let block = getCache(key)
    if (!block) {
      const json = await leveldb.get(key)
      block = blockModel.clone(JSON.parse(json))
    }
    debug(`getBlock height: `, block.getHeight())
    return block
  }
  const putPool = async (interblock) => {
    assert(interblockModel.isModel(interblock))
    const targetChainId = interblock.getTargetAddress().getChainId()
    const chainId = interblock.getChainId()
    const { height } = interblock.provenance
    const hash = interblock.getHash()
    const key = `${targetChainId}/pool/${chainId}_${pad(height)}_${hash}`
    await leveldb.put(key, interblock.serialize())
    putCache(key, interblock)
  }
  const putBlock = async (block) => {
    const chainId = block.getChainId()
    const height = block.getHeight()
    const hash = block.getHash()
    const string = block.serialize()
    const key = `${chainId}/blocks/${pad(height)}_${hash}`
    await leveldb.put(key, string)
    if (string.length > 200000) {
      _latestCache.set(chainId, block)
    } else {
      putCache(key, block)
    }
    debug(`putBlock`, chainId.substring(0, 9), height)
  }
  const queryLatest = async (chainId) => {
    debug(`queryLatest %o`, chainId.substring(0, 9))
    const gte = `${chainId}/blocks/`
    const lte = `${chainId}/blocks/~`
    let key
    for await (const [keyBuffer] of leveldb.iterator({
      reverse: true,
      limit: 1,
      keys: true,
      values: false,
      gte,
      lte,
    })) {
      key = keyBuffer.toString()
    }
    if (!key) {
      debug(`queryLatest nothing found`)
      return
    }
    let block = _latestCache.get(chainId)
    if (block) {
      const chainId = block.getChainId()
      const { height } = block.provenance
      const hash = block.getHash()
      const nextKey = `${chainId}/blocks/${pad(height)}_${hash}`
      if (key !== nextKey) {
        block = undefined
      }
    }
    if (!block) {
      block = getCache(key)
    }
    if (!block) {
      const json = await leveldb.get(key)
      block = blockModel.clone(JSON.parse(json))
    }
    debug(`queryLatest height: `, block.getHeight())
    return block
  }
  const putKeypair = async (keypair) => {
    debug(`putKeypair`)
    assert(keypairModel.isModel(keypair))
    const { key } = keypair.publicKey
    await leveldb.put(`crypto/${key}`, keypair.serialize())
  }

  const putPierceReply = async (chainId, txReply) => {
    assert(txReplyModel.isModel(txReply))
    debug(`putPierceReply`)
    const key = `${chainId}/piercings/rep_${txReply.getHash()}`
    // TODO get order by loosely trying to add the current tip count + 1
    // doesn't matter if it collides
    await leveldb.put(key, txReply.serialize())
    putCache(key, txReply)
  }
  const putPierceRequest = async (chainId, txRequest) => {
    assert(txRequestModel.isModel(txRequest))
    debug(`putPierceRequest`)
    const key = `${chainId}/piercings/req_${txRequest.getHash()}`
    // TODO get order by loosely trying to add the current tip count + 1
    // doesn't matter if it collides
    await leveldb.put(key, txRequest.serialize())
    putCache(key, txRequest)
  }

  const delPool = async (chainId, interblocks) => {
    // TODO check interblock was included in the block
    assert(Array.isArray(interblocks))
    const batch = leveldb.batch()
    const keys = []
    for (const interblock of interblocks) {
      const ibChainId = interblock.getChainId()
      const { height } = interblock.provenance
      const hash = interblock.getHash()
      const key = `${chainId}/pool/${ibChainId}_${pad(height)}_${hash}`
      batch.del(key)
      keys.push(key)
    }
    await batch.write()
    for (const key of keys) {
      delCache(key)
    }
    debug(`delPool complete for %o keys`, keys.length)
  }

  const delPierce = async (chainId, piercings) => {
    const { replies, requests } = piercings
    assert(Array.isArray(replies))
    assert(Array.isArray(requests))
    const batch = leveldb.batch()
    const keys = []
    for (const reply of replies) {
      const key = `${chainId}/piercings/rep_${reply.getHash()}`
      keys.push(key)
      batch.del(key)
    }
    for (const request of requests) {
      const key = `${chainId}/piercings/req_${request.getHash()}`
      keys.push(key)
      batch.del(key)
    }
    await batch.write()
    for (const key of keys) {
      delCache(key)
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
    debug(`queryPool`, chainId.substring(0, 9))
    const gte = `${chainId}/pool/`
    const lte = `${chainId}/pool/~`
    const keys = []
    for await (const [keyBuffer] of leveldb.iterator({
      keys: true,
      values: false,
      gte,
      lte,
    })) {
      keys.push(keyBuffer.toString())
    }
    const interblocks = []
    const uncachedKeys = keys.filter((key) => {
      const cached = getCache(key)
      if (!cached) {
        return true
      }
      interblocks.push(cached)
    })
    debug(`getMany`, uncachedKeys.length)
    const jsons = await leveldb.getMany(uncachedKeys)
    debug(`getMany done`)
    for (const json of jsons) {
      const interblock = interblockModel.clone(JSON.parse(json))
      interblocks.push(interblock)
    }
    debug(`queryPool count:`, interblocks.length)
    return interblocks
  }

  const queryPiercings = async (chainId) => {
    debug(`queryPiercings`, chainId.substring(0, 9))
    const gte = `${chainId}/piercings/`
    const lte = `${chainId}/piercings/~`
    const requests = []
    const replies = []
    // TODO handle timestamps on piercings
    const keys = []
    for await (const [keyBuffer] of leveldb.iterator({
      keys: true,
      values: false,
      gte,
      lte,
    })) {
      keys.push(keyBuffer.toString())
    }
    const uncachedKeys = keys.filter((key) => {
      const tx = getCache(key)
      if (!tx) {
        return true
      }
      if (key.startsWith(gte + `rep_`)) {
        assert(txReplyModel.isModel(tx))
        replies.push(tx)
      } else {
        assert(key.startsWith(gte + `req_`))
        assert(txRequestModel.isModel(tx))
        requests.push(tx)
      }
    })
    const jsons = await leveldb.getMany(uncachedKeys)
    for (const key of uncachedKeys) {
      const json = jsons.shift()
      if (key.startsWith(gte + `rep_`)) {
        const txReply = txReplyModel.clone(JSON.parse(json))
        replies.push(txReply)
      } else {
        assert(key.startsWith(gte + `req_`))
        const txRequest = txRequestModel.clone(JSON.parse(json))
        requests.push(txRequest)
      }
    }
    debug(`queryPiercings replies: %o`, replies.length)
    debug(`queryPiercings requests: %o`, requests.length)
    return { replies, requests }
  }

  const scanBaseChainId = async () => {
    debug('scanBaseChainId start')
    for await (const [keyBuffer] of leveldb.iterator({
      keys: true,
      values: false,
      limit: 1,
    })) {
      const key = keyBuffer.toString()
      const [baseChainId] = key.split('/')
      debug('scanBaseChainId end')
      return baseChainId
    }
  }
  const scanKeypair = async () => {
    debug('scanKeypair start')
    const gte = `crypto/`
    const lte = `crypto/~`
    for await (const [, json] of leveldb.iterator({
      keys: false,
      values: true,
      limit: 1,
      gte,
      lte,
    })) {
      const keypair = keypairModel.clone(JSON.parse(json))
      debug('scanKeypair end')
      return keypair
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

    scanKeypair,
    putKeypair,

    putPierceReply,
    putPierceRequest,
    queryPiercings,
    delPierce,
  }
}

export { dbFactory }
