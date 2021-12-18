import assert from 'assert-fast'
import {
  Address,
  Lock,
  Block,
  Socket,
  Interblock,
  TxRequest,
  TxReply,
} from '../../../../w015-models'
import levelup from 'levelup'
import memdown from 'memdown'
import { lockFactory } from './lockFactory'
import { dbFactory } from './dbFactory'
import Debug from 'debug'
const debug = Debug('interblock:services:consistency')

const consistencySourceFactory = (leveldb, lockPrefix = 'CI') => {
  leveldb = leveldb || levelup(memdown())
  assert(leveldb instanceof levelup)
  const lockProvider = lockFactory(leveldb)
  const db = dbFactory(leveldb)
  const locks = new Map() // TODO move to caching in the DB rather than here
  let baseAddress

  const putPoolInterblock = async ({ interblock }) => {
    assert(interblock instanceof Interblock)
    debug(`poolInterblock`)
    await db.putPool(interblock)
    debug(`poolInterblock complete`)
  }

  const putLockChain = async (address, expiryMs) => {
    assert(address instanceof Address)
    const chainId = address.getChainId()
    const shortId = chainId.substring(0, 9)
    const uuid = await lockProvider.tryAcquire(chainId, lockPrefix, expiryMs)
    if (!uuid) {
      debug(`lockChain could not lock ${shortId}`)
      return
    }
    debug(`locked chain: ${shortId} with: ${uuid}`)
    const latest = await getBlock({ address })
    debug(`block height: %o`, latest && latest.getHeight())
    const interblocks = await db.queryPool(chainId)
    debug(`interblocks fetched: ${interblocks.length}`)
    const piercings = await db.queryPiercings(chainId)
    debug(`piercings replies: %o`, piercings.replies.length)
    debug(`piercings requests: %o`, piercings.requests.length)
    const lock = Lock.create(latest, interblocks, uuid, piercings)
    locks.set(chainId, lock)
    debug(`lock complete: %O`, lock.uuid)
    return lock
  }

  const putUnlockChain = async (incomingLock) => {
    // TODO assert the incomingLock is reconciled
    assert(incomingLock instanceof Lock)
    assert(incomingLock.block, `cannot unlock without a block`)
    const { block } = incomingLock
    debug(`putUnlockChain`)
    const address = block.provenance.getAddress()
    const chainId = address.getChainId()
    const isLockValid = await lockProvider.isValid(chainId, incomingLock.uuid)
    if (!isLockValid) {
      // TODO retry the increase if lock failed, else chain will stall
      debug(`unlock rejected for ${chainId}`)
      return
    }
    const previousLock = locks.get(chainId)
    const previous = previousLock.block
    // TODO check getting latest is still the correct previous ?
    if (previous && !previous.isNextBlock(block)) {
      debug(`block is not next %O`, block.provenance.height)
      assert(previous.equals(block))
      debug(`no change`)
    } else if (!previous && !block.provenance.address.isGenesis()) {
      throw new Error(`next was not genesis: ${block.height}`)
    } else {
      await db.putBlock(block)
      debug(`block added`)
      // TODO store interblocks included in the block
      // TODO do not delete unincluded interblocks
      await db.delPool(chainId, previousLock.interblocks)
      // TODO remove only the ingested piercings
      // TODO if pierce lowered, remove all piercings
      await db.delPierce(chainId, previousLock.piercings)
    }
    await lockProvider.release(chainId, incomingLock.uuid)
    locks.delete(chainId)
    debug(`putUnlockChain complete`)
  }

  const getSockets = async (address) => {
    assert(address instanceof Address)
    const chainId = address.getChainId()
    debug(`getSockets for: %O`, chainId)
    const socketItems = await db.querySockets(chainId)

    // TODO check if the socket expired, delete if it has
    // ensure keepalives maintained for incoming sockets
    // also get the errored sockets list
    // if any socket items match this list, then delete them

    assert(Array.isArray(socketItems))
    assert(socketItems.every((item) => typeof item === 'object'))
    const sockets = socketItems.map(({ socketJson }) => {
      assert(socketJson)
      return Socket.clone(socketJson)
    })
    debug(`getSockets length: ${sockets.length}`)
    return sockets
  }

  const putSocket = async ({ address, socket }) => {
    debug(`putSocket`)
    assert(address instanceof Address)
    assert(socket instanceof Socket)
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
    assert(socket instanceof Socket)
    debug(`delSocket %o`, socket.id)

    // read the cleanup table to get the address mappings
    // for each one,
    // delete from the main table
    // if succeed, delete from the cleanup table
    // throw if any errors
  }

  const getIsPresent = (address) => db.queryLatest(address.getChainId())

  const getBlock = async ({ address, height }) => {
    if (!address) {
      address = await getBaseAddress()
    }
    assert(address instanceof Address)
    const chainId = address.getChainId()
    const shortId = chainId.substring(0, 9)
    debug(`getBlock for %o height: %o`, shortId, height)
    let block
    if (!Number.isInteger(height)) {
      block = await db.queryLatest(chainId)
      height = block && block.getHeight()
    } else {
      assert(height >= 0)
      block = await db.getBlock(chainId, height)
    }
    if (!block) {
      return
    }
    assert(block instanceof Block)
    assert(address.equals(block.provenance.getAddress()))
    assert.strictEqual(block.provenance.height, height)
    debug(`getBlock complete`, height)
    return block
  }
  const getBlocks = async ({ address, heights }) => {
    assert(address instanceof Address)
    assert(Array.isArray(heights))
    assert(heights.every((height) => Number.isInteger(height) && height >= 0))
    debug(`getBlocks heights.length: `, heights.length)
    const awaits = heights.map((height) => getBlock({ address, height }))
    const blocks = await Promise.all(awaits)
    return blocks
  }

  const getBaseAddress = async () => {
    debug(`getBaseAddress`)
    if (baseAddress) {
      return baseAddress
    }
    const baseChainId = await db.scanBaseChainId()
    if (!baseChainId) {
      return
    }
    const address = Address.create(baseChainId)
    assert.strictEqual(baseChainId, address.getChainId())
    baseAddress = address
    debug(`getBaseAddress: ${address.getChainId()}`)
    return baseAddress
  }

  const putPierceReply = async ({ txReply }) => {
    assert(txReply instanceof TxReply)
    const address = txReply.getAddress()
    assert(address.isResolved())
    const chainId = address.getChainId()
    debug(`putPierceReply %o %o`, chainId.substring(0, 9), txReply)
    // TODO check chainId exists, and pierce is enabled in the latest block
    await db.putPierceReply(chainId, txReply)
  }
  const putPierceRequest = async ({ txRequest }) => {
    assert(txRequest instanceof TxRequest)
    const address = Address.create(txRequest.to)
    assert(address.isResolved())
    const chainId = address.getChainId()
    debug(`putPierceRequest %o %o`, chainId.substring(0, 9), txRequest)
    // TODO check chainId exists, and pierce is enabled in the latest block
    await db.putPierceRequest(chainId, txRequest)
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
    getBaseAddress,

    putPoolInterblock,
    putPierceRequest,
    putPierceReply,
  }
}
export { consistencySourceFactory }
