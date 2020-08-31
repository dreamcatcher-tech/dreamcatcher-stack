const assert = require('assert')
const debug = require('debug')('interblock:consistency:s3')
const _ = require('lodash')
const {
  cryptoCacher,
  blockModel,
  interblockModel,
} = require('../../../../w015-models')
const { ramS3Factory } = require('./ramS3Factory')

const s3Factory = (s3 = ramS3Factory()) => {
  const putInterblock = async (Key, model) => {
    // TODO retry several times if fail
    const params = {
      Bucket: 'wbinterbucket',
      Key,
      Body: model.serialize(),
      ContentType: 'application/json',
    }
    const result = await s3.putObject(params).promise()
    debug(`putInterblock: %O`, Key)
    assert(result)
  }

  const getInterblock = async (Key) => {
    const params = {
      Bucket: 'wbinterbucket',
      Key,
    }
    debug(`getInterblock: %O`, Key)
    try {
      const result = await s3.getObject(params).promise()
      const interblockJson = result.Body.toString()
      const obj = JSON.parse(interblockJson)
      await cryptoCacher.cacheVerifyHash(obj)
      // TODO find why using obj fails, but json passes
      const interblock = interblockModel.clone(interblockJson)
      debug(`s3GetInterblock complete`)
      return interblock
    } catch (e) {
      debug(`error fetching: %O %O`, Key, e.message)
      // TODO only allow if key not found
      // TODO add retries if network error occured
    }
  }

  const deleteInterblocks = async (toDelete) => {
    assert(Array.isArray(toDelete))
    debug(`deleteInterblocks: %O`, toDelete.length)
    const awaits = toDelete.map(async (Key) => {
      const params = {
        Bucket: 'wbinterbucket',
        Key,
      }
      await s3.deleteObject(params).promise()
    })
    await Promise.all(awaits)
    debug(`deleteInterblocks complete`)
  }

  const putBlock = async (Key, model) => {
    const params = {
      Bucket: 'wbblockbucket',
      Key,
      Body: model.serialize(),
      ContentType: 'application/json',
    }
    const result = await s3.putObject(params).promise()
    debug(`putBlock: %O`, Key)
    assert(result)
  }

  const getBlock = async (Key) => {
    const params = {
      Bucket: 'wbblockbucket',
      Key,
    }
    debug(`getBlock: %O`, Key)
    const result = await s3.getObject(params).promise()
    const blockJson = result.Body.toString()
    const obj = JSON.parse(blockJson)
    // TODO move to use obj once know why fails
    await cryptoCacher.cacheVerifyHash(obj)
    const block = blockModel.clone(blockJson)
    debug(`getBlock complete: %O`, Key)
    return block
  }

  return {
    putInterblock,
    getInterblock,
    deleteInterblocks,
    putBlock,
    getBlock,
  }
}

const s3Keys = {
  fromInterblock: (interblock) => {
    const interblockHash = interblock.getHash()
    const originChainId = interblock.provenance.getAddress().getChainId()
    const { height } = interblock.provenance
    const remote = interblock.getRemote()
    const targetChainId = remote ? remote.address.getChainId() : '#LINEAGE'
    const s3Key = `${originChainId}/${height}_${targetChainId}_${interblockHash}`
    return s3Key
  },

  fromPoolItem: (poolItem) => {
    const { chainId, originChainId_height_type, interblockHash } = poolItem
    const [origin, height, type] = originChainId_height_type.split('_')
    const target = type === 'light' ? '#LINEAGE' : chainId
    const key = `${origin}/${height}_${target}_${interblockHash}`
    return key
  },

  fromBlock: (block) => {
    const blockItem = _dbChainsItemFromBlock(block)
    return s3Keys.fromBlockItem(blockItem)
  },

  fromBlockItem: (blockItem) => {
    const { chainId, height, blockHash, shortestLineage } = blockItem
    const s3Key = `${chainId}/${height}_${blockHash}`
    return s3Key
  },
}

const _dbChainsItemFromBlock = (block) => {
  // TODO merge with other _db calls
  const chainId = block.provenance.getAddress().getChainId()
  const { height } = block.provenance
  const blockHash = block.getHash()
  const shortestLineage = block.provenance.lineage[0]
  const item = { chainId, height, blockHash, shortestLineage }
  return item
}

module.exports = { s3Factory, s3Keys }
