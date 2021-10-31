import assert from 'assert-fast'
import compact from 'lodash.compact'
import {
  addressModel,
  integrityModel,
  provenanceModel,
  lockModel,
  blockModel,
  socketModel,
  interblockModel,
  txRequestModel,
  txReplyModel,
} from '../../../../w015-models'
import { lockFactory } from './lockFactory'
import { dbFactory } from './dbFactory'
import { s3Factory, s3Keys } from './s3Factory'
import { ramDynamoDbFactory } from './ramDynamoDbFactory'
import { ramS3Factory } from './ramS3Factory'
import Debug from 'debug'
const debug = Debug('interblock:services:consistency')

// TODO move all _db to own file, like s3
const _dbChainsItemFromBlock = (block) => {
  const chainId = block.provenance.getAddress().getChainId()
  const { height } = block.provenance
  const blockHash = block.getHash()
  const shortestLineage = block.provenance.lineage[0]
  const item = { chainId, height, blockHash, shortestLineage }
  return item
}

const _dbPoolFromAddress = (targetAddress) => (interblock) =>
  _dbPoolItem(interblock, targetAddress)

const _dbPoolItem = (interblock) => {
  const chainId = interblock.getTargetAddress().getChainId()
  const originChainId = interblock.provenance.getAddress().getChainId()
  const { height } = interblock.provenance
  const originChainId_height = `${originChainId}_${height}`
  const interblockHash = interblock.getHash()
  const isDeleted = false
  return { chainId, originChainId_height, interblockHash, isDeleted }
}

const consistencySourceFactory = (dynamoDb, s3Base, awsRequestId = 'CI') => {
  dynamoDb = dynamoDb || ramDynamoDbFactory()
  s3Base = s3Base || ramS3Factory()
  const lock = lockFactory(dynamoDb)
  const db = dbFactory(dynamoDb)
  const s3 = s3Factory(s3Base)
  const locks = new Map() // TODO ensure no orphans

  const putPoolInterblock = async ({ interblock }) => {
    assert(interblockModel.isModel(interblock))
    debug(`poolInterblock`)
    // TODO make a table so if this batch does not complete, no orphans
    const poolItem = _dbPoolItem(interblock)
    const s3Key = s3Keys.fromInterblock(interblock)
    const s3Await = s3.putInterblock(s3Key, interblock)
    await db.putPool(poolItem)
    await s3Await
    debug(`poolInterblock complete`)
  }

  const putLockChain = async (address, expiryMs) => {
    assert(addressModel.isModel(address))
    const chainId = address.getChainId()
    const uuid = await lock.tryAcquire(chainId, awsRequestId, expiryMs)
    if (!uuid) {
      debug(`lockChain could not lock ${chainId}`)
      return
    }
    debug(`locked chain: ${chainId} with: ${uuid}`)
    const blockPromise = getBlock({ address })
    const allPoolItems = await db.queryPool(chainId)
    const poolItems = allPoolItems.filter(({ isDeleted }) => !isDeleted)
    debug(`pool total: ${allPoolItems.length} valid: ${poolItems.length}`)
    const interblockAwaits = poolItems.map(async (poolItem) => {
      const key = s3Keys.fromPoolItem(poolItem)
      const interblock = await s3.getInterblock(key)
      if (!interblock) {
        return
      }
      assert(interblockModel.isModel(interblock))
      assert.strictEqual(poolItem.interblockHash, interblock.getHash())
      return interblock
    })
    const resolved = await Promise.all(interblockAwaits)
    const interblocks = compact(resolved)
    // TODO remove light blocks from lock - will be superseded when modelchains is implemented
    debug(`interblocks fetched: ${interblocks.length}`)
    const block = await blockPromise
    debug(`block height: %O`, block && block.provenance.height)
    debug(`interblock count: %O`, interblocks.length)

    const piercingsRaw = await db.queryPiercings(chainId)
    const requests = []
    const replies = []
    piercingsRaw.forEach(({ txRequest, txReply }) => {
      assert(!txRequest || !txReply)
      if (txRequest) {
        requests.push(txRequest)
      }
      if (txReply) {
        replies.push(txReply)
      }
    })
    const piercings = { requests, replies }
    debug(`piercings requests: %o replies %o`, requests.length, replies.length)
    const lockInstance = lockModel.create(block, interblocks, uuid, piercings)
    assert(!locks.has(chainId))
    locks.set(chainId, lockInstance)
    debug(`lock complete: %O`, lockInstance.uuid)
    return lockInstance
  }

  const putUnlockChain = async (incomingLock) => {
    // TODO assert the incomingLock is reconciled
    assert(lockModel.isModel(incomingLock))
    assert(incomingLock.block, `cannot unlock without a block`)
    const { block } = incomingLock
    debug(`putUnlockChain`)
    const address = block.provenance.getAddress()
    const chainId = address.getChainId()
    const isLockValid = await lock.isValid(chainId, incomingLock.uuid)
    if (!isLockValid) {
      // TODO retry the increase if lock failed, else chain will stall
      debug(`unlock rejected for ${chainId}`)
      return
      // TODO figure out conditions where interblocks can get lost, or chains get stuck
      // TODO work out echoes of blocks failing provenance checks
    }
    const previousLock = locks.get(chainId)
    const previous = previousLock.block
    // TODO check getting latest is still the correct previous ?
    if (previous && !previous.isNextBlock(block)) {
      debug(`block is not next %O`, block.provenance.height)
      debug(`no change: `, previous.equals(block))
    } else if (!previous && !block.provenance.address.isGenesis()) {
      throw new Error(`next was not genesis: ${block.height}`)
    } else {
      // TODO deal with conflicts detected between blocks being added, and report them
      const s3Key = s3Keys.fromBlock(block)
      await s3.putBlock(s3Key, block)
      const dbChainsItem = _dbChainsItemFromBlock(block)
      await db.putBlock(dbChainsItem)
      debug(`block added`)

      const purgePromise = _purgePool(block, previousLock.interblocks)
      const piercePromise = _purgePiercings(block, previousLock.piercings)
      await Promise.all([purgePromise, piercePromise])
    }
    locks.delete(chainId)
    await lock.release(chainId, incomingLock.uuid)
    debug(`putUnlockChain complete`)
  }

  const _purgePool = async (block, interblocks) => {
    // TODO merge with purging of piercings
    const toDelete = _interblocksToDelete(block, interblocks)
    const address = block.provenance.getAddress()
    const toDeleteMarked = toDelete
      .map(_dbPoolFromAddress(address))
      .map((item) => ({ ...item, isDeleted: true }))
    await db.putPool(toDeleteMarked)
    debug(`_purgePool isDeleted marked`)
    const toDeleteItems = toDeleteMarked.map(
      ({ chainId, originChainId_height }) => ({
        chainId,
        originChainId_height,
      })
    )
    await db.delPool(toDeleteItems)
    debug(`_purgePool complete`)
  }

  const _purgePiercings = async (block, previousPiercings) => {
    // TODO check previous blocks up to some time limit
    // TODO if pierce lowered, remove all piercings
    // TODO remove only the ingested piercings
    const chainId = block.getChainId()
    const { requests, replies } = previousPiercings
    const toDelete = [...requests, ...replies]
    const toDeleteItems = toDelete.map((action) => {
      const hash = action.getHash()
      const item = { chainId, hash }
      return item
    })
    return db.delPierce(toDeleteItems)
  }

  const getSockets = async (address) => {
    assert(addressModel.isModel(address))
    const chainId = address.getChainId()
    debug(`getSockets for: %O`, chainId)
    const socketItems = await db.querySockets(chainId)

    // check if the socket expired, delete if it has
    // ensure keepalives maintained for incoming sockets
    // also get the errored sockets list
    // if any socket items match this list, then delete them

    assert(Array.isArray(socketItems))
    assert(socketItems.every((item) => typeof item === 'object'))
    const sockets = socketItems.map(({ socketJson }) => {
      assert(socketJson)
      return socketModel.clone(socketJson)
    })
    debug(`getSockets length: ${sockets.length}`)
    return sockets
  }

  const putSocket = async ({ address, socket }) => {
    debug(`putSocket`)
    assert(addressModel.isModel(address))
    assert(socketModel.isModel(socket))
    const chainId = address.getChainId()
    const socketId = socket.id
    const updatedTime = parseInt(Date.now() / 1000) // used to expire item
    const socketJson = socket.serialize()
    const item = { chainId, socketId, updatedTime, socketJson }
    // put in the cleanup table first, and if succeed, put in real table
    // use same expiration time, so know dynamo will eventually clean up
    await db.putSocket(item)
    debug(`putSocket complete`)
  }

  const delSocket = async (socket) => {
    assert(socketModel.isModel(socket))
    debug(`delSocket %o`, socket.id)

    // read the cleanup table to get the address mappings
    // for each one,
    // delete from the main table
    // if succeed, delete from the cleanup table
    // throw if any errors
  }

  const getIsPresent = (address) => db.queryLatest(address.getChainId())

  const getBlock = async ({ address, height }) => {
    debug(`getBlock`, address && address.getChainId(), height)
    if (!address) {
      assert(!height)
      return _getBaseAddress()
    }
    assert(addressModel.isModel(address))
    let chainId = address.getChainId()
    let blockItem
    if (!Number.isInteger(height)) {
      blockItem = await db.queryLatest(chainId)
    } else {
      blockItem = await db.getBlock({ chainId, height })
    }
    if (!blockItem) {
      return
    }
    if (!Number.isInteger(height)) {
      height = blockItem.height
    }
    const s3Key = s3Keys.fromBlockItem(blockItem)
    debug(`s3.getBlock(s3Key)`, s3Key)
    const block = await s3.getBlock(s3Key)
    assert(blockModel.isModel(block))
    assert(address.equals(block.provenance.getAddress()))
    assert.strictEqual(block.getHash(), blockItem.blockHash)
    assert.strictEqual(block.provenance.height, height)
    debug(`getBlock complete`)
    return block
  }
  const getBlocks = async ({ address, heights }) => {
    assert(addressModel.isModel(address))
    assert(Array.isArray(heights))
    assert(heights.every((height) => Number.isInteger(height) && height >= 0))
    debug(`getBlocks heights.length: `, heights.length)
    const awaits = heights.map((height) => getBlock({ address, height }))
    const blocks = await Promise.all(awaits)
    return blocks
  }

  const _getBaseAddress = async () => {
    debug(`getBaseAddress`)
    const baseItem = await db.scanBaseChainId()
    if (!baseItem) {
      return
    }
    assert(baseItem.chainId)
    const address = addressModel.create(baseItem.chainId)
    assert.strictEqual(baseItem.chainId, address.getChainId())
    debug(`getBaseAddress: ${address.getChainId()}`)
    return address
  }

  // make this the same as pool interblock
  // pierce channel should optionally have a schema for all actions, or a check function
  const putPierceRequest = async ({ txRequest }) => {
    assert(txRequestModel.isModel(txRequest))
    const address = addressModel.create(txRequest.to)
    assert(address.isResolved())
    const chainId = address.getChainId()
    const hash = txRequest.getHash()
    debug(`putPierceRequest %o %o`, chainId, txRequest)
    const item = { chainId, hash, txRequest }
    // TODO check chainId exists, and pierce is enabled in the latest block
    await db.putPierce(item)
  }
  const putPierceReply = async ({ txReply }) => {
    assert(txReplyModel.isModel(txReply))
    const address = txReply.getAddress()
    assert(address.isResolved())
    const chainId = address.getChainId()
    const hash = txReply.getHash()
    debug(`putPierceReply %o %o`, chainId, txReply)
    const item = { chainId, hash, txReply }
    // TODO check chainId exists, and pierce is enabled in the latest block
    await db.putPierce(item)
  }
  const _interblocksToDelete = (block, interblocks) => {
    const toDelete = interblocks.filter((interblock) => {
      return false
      // TODO clean up when move to leveldb
    })
    return interblocks
  }
  return {
    putSocket,
    getSockets,
    delSocket,

    putLockChain,
    putUnlockChain,

    getIsPresent,
    getBlock,
    getBlocks,

    putPoolInterblock,
    putPierceRequest,
    putPierceReply,
  }
}
export { consistencySourceFactory }
