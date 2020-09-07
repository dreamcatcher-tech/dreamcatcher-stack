const assert = require('assert')
const _ = require('lodash')
const {
  addressModel,
  integrityModel,
  provenanceModel,
  lockModel,
  blockModel,
  socketModel,
  interblockModel,
} = require('../../../../w015-models')
const debug = require('debug')('interblock:services:consistency')

const _addressFromChainId = (chainId) => {
  const blank = integrityModel.create()
  const integrity = integrityModel.clone({ ...blank, hash: chainId })
  const address = addressModel.create(integrity)
  assert.equal(address.getChainId(), chainId)
  return address
}

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

const _dbPoolItem = (interblock, targetAddress) => {
  const chainId = targetAddress.getChainId()
  const remote = interblock.getRemote()
  const type = remote ? 'heavy' : 'light'
  const originChainId = interblock.provenance.getAddress().getChainId()
  const { height } = interblock.provenance
  const originChainId_height_type = `${originChainId}_${height}_${type}`
  const interblockHash = interblock.getHash()
  const isDeleted = false
  return { chainId, originChainId_height_type, interblockHash, isDeleted }
}

const _dbSubscriptionFromBlock = (block) => (subscriptionAddress) => {
  const chainId = subscriptionAddress.getChainId()
  const targetChainId = block.provenance.getAddress().getChainId()
  const alias = block.network.getAlias(subscriptionAddress)
  const channel = block.network[alias]
  assert(channel)
  const { heavyHeight, lineageHeight } = channel
  const { height } = block.provenance
  const item = {
    chainId,
    targetChainId,
    heavyHeight,
    lineageHeight,
    height,
  }
  return item
}

const { lockFactory } = require('./lockFactory')
const { dbFactory } = require('./dbFactory')
const { s3Factory, s3Keys } = require('./s3Factory')
const { ramDynamoDbFactory } = require('./ramDynamoDbFactory')
const { ramS3Factory } = require('./ramS3Factory')

const consistencySourceFactory = (dynamoDb, s3Base, awsRequestId = 'CI') => {
  dynamoDb = dynamoDb || ramDynamoDbFactory()
  s3Base = s3Base || ramS3Factory()
  const lock = lockFactory(dynamoDb)
  const db = dbFactory(dynamoDb)
  const s3 = s3Factory(s3Base)
  const locks = new Map() // TODO ensure no orphans

  const putPoolInterblock = async ({ affectedAddresses, interblock }) => {
    // TODO ensure if address is not target, use light interblock
    assert(affectedAddresses.every(addressModel.isModel))
    assert(interblockModel.isModel(interblock))
    debug(`poolInterblocks for ${affectedAddresses.length} addresses`)
    // TODO make a table so if this batch does not complete, no orphans
    let isLightUsed, isHeavyUsed
    const light = interblock.getWithoutRemote()
    const poolItems = affectedAddresses.map((address) => {
      // TODO move scavenging up to FSMs explicitly, and only in sqsRx
      let interblockToPool = light
      if (address.equals(interblock.getTargetAddress())) {
        isHeavyUsed = true
        interblockToPool = interblock
      } else {
        isLightUsed = true
      }
      return _dbPoolItem(interblockToPool, address)
    })
    debug(`poolItems count: %O`, poolItems.length)
    const s3Awaits = []
    if (isLightUsed) {
      const s3Key = s3Keys.fromInterblock(light)
      s3Awaits.push(s3.putInterblock(s3Key, light)) // TODO multithread
    }
    if (isHeavyUsed) {
      const s3Key = s3Keys.fromInterblock(interblock)
      s3Awaits.push(s3.putInterblock(s3Key, interblock)) // TODO multithread
    }
    await db.putPool(poolItems)
    await Promise.all(s3Awaits)
    debug(`poolInterblock complete for: ${affectedAddresses.length} addresses`)
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
      assert.equal(poolItem.interblockHash, interblock.getHash())
      return interblock
    })
    const resolved = await Promise.all(interblockAwaits)
    const interblocks = _.compact(resolved)
    debug(`interblocks fetched: ${interblocks.length}`)
    const block = await blockPromise
    debug(`block height: %O`, block && block.provenance.height)
    debug(`interblock count: %O`, interblocks.length)
    const lockInstance = lockModel.create(block, interblocks, uuid)
    assert(!locks.has(chainId))
    locks.set(chainId, lockInstance)
    debug(`lock complete: %O`, lockInstance.uuid)
    return lockInstance
  }

  const putUnlockChain = async (incomingLock) => {
    // TODO assert the incomingLock is reconciled
    debug(`putUnlockChain`)
    assert(lockModel.isModel(incomingLock))
    assert(incomingLock.block, `cannot unlock without a block`)
    const address = incomingLock.block.provenance.getAddress()
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
    const { block } = incomingLock
    const previous = previousLock.block
    // TODO check getting latest is still the correct previous ?
    if (previous && !previous.isNext(block)) {
      debug(`block is not next %O`, block.provenance.height)
      debug(`no change: `, previous.equals(block))
    } else if (!previous && !block.provenance.address.isGenesis()) {
      debug(`next was not genesis: %O`, block.height)
    } else {
      // TODO deal with conflicts detected between blocks being added, and report them
      const s3Key = s3Keys.fromBlock(block)
      await s3.putBlock(s3Key, block)
      const dbChainsItem = _dbChainsItemFromBlock(block)
      await db.putBlock(dbChainsItem)
      debug(`block added`)
    }

    const routePromise = _updateRouteTable(block, previous)
    const purgePromise = _purgePool(previousLock, incomingLock)
    await Promise.all([routePromise, purgePromise])
    await lock.release(chainId, incomingLock.uuid)
    locks.delete(chainId)
    debug(`putUnlockChain complete`)
  }
  const _updateRouteTable = async (block, previous) => {
    // need previous block so can ensure route table set correctly
    assert(blockModel.isModel(block))
    assert(!previous || blockModel.isModel(previous))
    const previousAliases = previous ? previous.network.getAliases() : []
    const previousResolvedAliases = previousAliases.filter((alias) =>
      previous.network[alias].address.isResolved()
    )
    const blockResolvedAliases = block.network
      .getAliases()
      .filter((alias) => block.network[alias].address.isResolved())
    const newAddresses = blockResolvedAliases
      .filter((alias) => !previousResolvedAliases.includes(alias))
      .map((alias) => block.network[alias].address)
    const delAddresses = previousResolvedAliases
      .filter((alias) => !blockResolvedAliases.includes(alias))
      .map((alias) => block.network[alias].address)
    const newChainIds = newAddresses.map((address) => address.getChainId())
    debug(`_updateRouteTable newAddresses`, newChainIds)
    const newItems = newAddresses.map(_dbSubscriptionFromBlock(block))
    const delItems = delAddresses.map(_dbSubscriptionFromBlock(block))
    await Promise.all([
      db.putSubscriptions(newItems),
      db.delSubscriptions(delItems),
    ])
    debug(`updateRouteTable complete`)
  }

  const _purgePool = async (previousLock, incomingLock) => {
    // TODO assert incoming has been reconciled
    assert(incomingLock.block)
    const previousIbs = previousLock.interblocks
    const incomingIbs = incomingLock.interblocks
    assert(previousIbs.length >= incomingIbs.length)
    const toDelete = _.difference(previousIbs, incomingIbs)
    const address = incomingLock.block.provenance.getAddress()
    const toDeleteMarked = toDelete
      .map(_dbPoolFromAddress(address))
      .map((item) => ({ ...item, isDeleted: true }))
    await db.putPool(toDeleteMarked)
    debug(`_purgePool isDeleted marked`)
    const orphans = await _findOrphans(toDelete)
    debug(`_purgePool _findOrphans found: ${orphans.length}`)
    const orphanS3Keys = orphans.map(s3Keys.fromInterblock)
    await s3.deleteInterblocks(orphanS3Keys)
    const toDeleteItems = toDeleteMarked.map(
      ({ chainId, originChainId_height_type }) => ({
        chainId,
        originChainId_height_type,
      })
    )
    await db.delPool(toDeleteItems)
    debug(`_purgePool complete`)
  }

  const _findOrphans = async (toDelete) => {
    const heavies = toDelete.filter((interblock) => interblock.getRemote())
    const lights = toDelete.filter((interblock) => !interblock.getRemote())
    const lightAwaits = lights.map(async (interblock) => {
      const isAnyAffected = await getIsAnyAffected(interblock)
      return isAnyAffected ? false : interblock
    })
    const lightOrphans = _.compact(await Promise.all(lightAwaits))
    return [...lightOrphans, ...heavies]
  }

  const getLineage = async ({ provenance, height = 0 }) => {
    debug(`getLineage from height: `, height)
    assert(provenanceModel.isModel(provenance))
    assert(Number.isInteger(height) && height >= 0)
    assert(height < provenance.height)
    const address = provenance.getAddress()
    const blocks = []
    // TODO allow multiple lineage paths - choose shortest
    let shortestHeight
    let nextProvenance = provenance
    do {
      shortestHeight = nextProvenance.getShortestHeight()
      const block = await getBlock({ address, height: shortestHeight })
      assert(blockModel.isModel(block))
      blocks.push(block)
      nextProvenance = block.provenance
    } while (shortestHeight > height)
    const lineage = blocks.map((block) => interblockModel.create(block))
    return lineage
  }

  const getIsAnyAffected = async (interblock) => {
    assert(interblockModel.isModel(interblock))
    const chainId = interblock.provenance.getAddress().getChainId()
    const isSingle = true
    // TODO use query to ensure no old interblocks pass this test
    const affected = await db.queryAffected(chainId, isSingle)
    return !!affected
  }

  const getAffected = async (interblock) => {
    assert(interblockModel.isModel(interblock))
    const chainId = interblock.provenance.getAddress().getChainId()
    const { height } = interblock.provenance
    // TODO move to a schema based query for heights
    const allAffectedItems = await db.queryAffected(chainId)

    const affectedByHeight = allAffectedItems.filter((item) => {
      const { targetChainId, heavyHeight, lineageHeight } = item
      const isHeavy = targetChainId.startsWith(targetChainId)
      return isHeavy ? heavyHeight < height : lineageHeight < height
    })
    const affectedAddresses = affectedByHeight.map(({ targetChainId }) =>
      _addressFromChainId(targetChainId)
    )
    const deduped = new Set(affectedAddresses)
    debug(`dbQueryAffected items length: %O`, deduped.size)
    return [...deduped]
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
    assert.equal(block.getHash(), blockItem.blockHash)
    assert.equal(block.provenance.height, height)
    debug(`getBlock complete`)
    return block
  }

  const _getBaseAddress = async () => {
    debug(`getBaseAddress`)
    const baseItem = await db.scanBaseChainId()
    if (!baseItem) {
      return
    }
    assert(baseItem.chainId)
    const address = addressModel.create(baseItem.chainId)
    assert.equal(baseItem.chainId, address.getChainId())
    debug(`getBaseAddress: ${address.getChainId()}`)
    return address
  }

  return {
    putSocket,
    getSockets,
    delSocket,

    putPoolInterblock,
    putLockChain,
    putUnlockChain,

    getLineage,
    getIsAnyAffected,
    getAffected,
    getIsPresent,
    getBlock,
  }
}
module.exports = { consistencySourceFactory }
