import assert from 'assert-fast'
import LevelUp from 'levelup'
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
const dbFactory = (leveldb) => {
  assert(leveldb instanceof LevelUp)
  assert(leveldb.isOperational())

  const getBlock = async (chainId, height) => {
    assert.strictEqual(typeof chainId, 'string')
    assert(Number.isInteger(height))
    assert(height >= 0)
    const key = `${chainId}/blocks/${height}`
    for await (const [keyBuffer, json] of leveldb.iterator({
      limit: 1,
      keys: false,
      values: true,
      gte: key,
      lte: key + '~',
    })) {
      // TODO check hash matches
      // TODO check that no other block exists at this height
      const block = blockModel.clone(JSON.parse(json))
      debug(`getBlock height: `, block.getHeight())
      return block
    }
  }
  const putPool = async (interblock) => {
    assert(interblockModel.isModel(interblock))
    const targetChainId = interblock.getTargetAddress().getChainId()
    const chainId = interblock.getChainId()
    const { height } = interblock.provenance
    const hash = interblock.getHash()
    const key = `${targetChainId}/pool/${chainId}_${height}_${hash}`
    await leveldb.put(key, interblock.serialize())
  }

  const putBlock = async (block) => {
    const chainId = block.getChainId()
    const height = block.getHeight()
    const hash = block.getHash()
    const string = block.serialize()
    const key = `${chainId}/blocks/${height}_${hash}`
    await leveldb.put(key, string)
    debug(`putBlock`, chainId.substring(0, 9), height)
  }

  // TODO use transactions to not add what is later deleted
  const putSubscriptions = (items) => _dbPut('dbSubscribers', items)

  const putSocket = async (item) => _dbPut('dbSockets', item)

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
  }
  const putPierceRequest = async (chainId, txRequest) => {
    assert(txRequestModel.isModel(txRequest))
    debug(`putPierceRequest`)
    const key = `${chainId}/piercings/req_${txRequest.getHash()}`
    // TODO get order by loosely trying to add the current tip count + 1
    // doesn't matter if it collides
    await leveldb.put(key, txRequest.serialize())
  }

  const delSubscriptions = (items) => _dbDel('dbSubscribers', items)

  const delPool = async (chainId) => {
    const gte = `${chainId}/pool/`
    const lte = `${chainId}/pool/~`
    await leveldb.clear({ gte, lte })
    debug(`delPool complete`)
  }

  const delPierce = async (chainId, piercings) => {
    const { replies, requests } = piercings
    assert(Array.isArray(replies))
    assert(Array.isArray(requests))
    const batch = leveldb.batch()
    for (const reply of replies) {
      batch.del(`${chainId}/piercings/rep_${reply.getHash()}`)
    }
    for (const request of requests) {
      batch.del(`${chainId}/piercings/req_${request.getHash()}`)
    }
    await batch.write()
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

  const queryLatest = async (chainId) => {
    debug(`queryLatest %o`, chainId.substring(0, 9))
    const gte = `${chainId}/blocks/`
    const lte = `${chainId}/blocks/~`
    for await (const [, json] of leveldb.iterator({
      reverse: true,
      limit: 1,
      keys: false,
      values: true,
      gte,
      lte,
    })) {
      const block = blockModel.clone(JSON.parse(json))
      debug(`queryLatest height: `, block.getHeight())
      return block
    }
    debug(`queryLatest nothing found`)
  }

  const queryPool = async (chainId) => {
    debug(`queryPool`, chainId.substring(0, 9))
    const gte = `${chainId}/pool/`
    const lte = `${chainId}/pool/~`
    const interblocks = []
    for await (const [, json] of leveldb.iterator({
      keys: false,
      values: true,
      gte,
      lte,
    })) {
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
    for await (const [keyBuffer, json] of leveldb.iterator({
      keys: true,
      values: true,
      gte,
      lte,
    })) {
      const key = keyBuffer.toString()
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
    for await (const [keyBuffer] of leveldb.iterator({
      keys: true,
      values: false,
      limit: 1,
    })) {
      const key = keyBuffer.toString()
      const [baseChainId] = key.split('/')
      return baseChainId
    }
  }
  const scanKeypair = async () => {
    const gte = `crypto/`
    const lte = `crypto/~`
    for await (const [, json] of leveldb.iterator({
      keys: false,
      values: true,
      limit: 1,
      gte,
      lte,
    })) {
      return keypairModel.clone(JSON.parse(json))
    }
  }

  return {
    putPool,
    putBlock,
    putSubscriptions,
    putSocket,

    delSubscriptions,
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
