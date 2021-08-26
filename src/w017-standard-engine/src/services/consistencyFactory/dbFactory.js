import { assert } from 'chai/index.mjs'
import { ramDynamoDbFactory } from './ramDynamoDbFactory'
import Debug from 'debug'
const debug = Debug('interblock:consistency:db')

const dbFactory = (dynamodb = ramDynamoDbFactory()) => {
  let baseChainItem

  const _dbGet = async (TableName, Key) => {
    const params = {
      TableName,
      Key,
      ConsistentRead: true,
      ReturnConsumedCapacity: 'TOTAL',
    }
    const result = await dynamodb.get(params).promise()
    const { ConsumedCapacity, Item } = result
    return Item
  }

  const getBlock = (Key) => _dbGet('dbChains', Key)

  const _dbPut = async (TableName, Items) => {
    assert(TableName)
    assert(Items)
    if (!Array.isArray(Items)) {
      Items = [Items]
    }

    const awaits = Items.map((Item) => {
      const params = {
        TableName,
        Item,
        ReturnConsumedCapacity: 'TOTAL',
      }
      return dynamodb.put(params).promise()
    })
    await Promise.all(awaits)
  }

  const putPool = (items) => _dbPut('dbPools', items)

  const putBlock = (item) => _dbPut('dbChains', item)

  // TODO use transactions to not add what is later deleted
  const putSubscriptions = (items) => _dbPut('dbSubscribers', items)

  const putSocket = async (item) => _dbPut('dbSockets', item)

  const putKeypair = async (item) => _dbPut('dbCrypto', item)

  const putPierce = async (item) => _dbPut('dbPiercings', item)

  const _dbDel = async (TableName, items) => {
    assert(Array.isArray(items))
    const awaits = items.map((Key) => {
      const params = {
        TableName,
        Key,
        ReturnConsumedCapacity: 'TOTAL',
      }
      // TODO use conditions to not delete newer things
      return dynamodb.delete(params).promise()
    })
    await Promise.all(awaits)
  }

  const delSubscriptions = (items) => _dbDel('dbSubscribers', items)

  const delPool = (toDelete) => _dbDel('dbPools', toDelete)

  const delPierce = (toDelete) => _dbDel('dbPiercings', toDelete)

  const _dbQuery = async (TableName, chainId, isSingle) => {
    const params = {
      TableName,
      KeyConditionExpression: 'chainId = :hkey',
      ExpressionAttributeValues: { ':hkey': chainId },
      ScanIndexForward: false,
      ConsistentRead: true,
      ReturnConsumedCapacity: 'TOTAL',
    }
    if (isSingle) {
      params.Limit = 1
    }
    debug(`dbQuery: %O %O`, TableName, chainId)
    const result = await dynamodb.query(params).promise()
    const { ConsumedCapacity, Items } = result
    // TODO handle query being too long for a single return
    assert(Array.isArray(Items))
    debug(`dbQuery items length: %O`, Items.length)
    if (isSingle) {
      return Items[0]
    }
    return Items
  }

  // TODO move schema to support height filter in query
  // TODO get only the highest targetChainId_height entry
  // TODO check scavenging done correctly here
  const queryAffected = (chainId, isSingle) =>
    _dbQuery('dbSubscribers', chainId, isSingle)

  const querySockets = (chainId) => _dbQuery('dbSockets', chainId)

  const queryLatest = (chainId) => {
    const isSingle = true
    return _dbQuery('dbChains', chainId, isSingle)
  }

  const queryPool = (chainId) => _dbQuery('dbPools', chainId)

  const queryPiercings = (chainId) => _dbQuery('dbPiercings', chainId)

  const _scanFirst = async (TableName) => {
    const params = {
      TableName,
      ConsistentRead: true,
      Limit: 1,
    }
    const result = await dynamodb.scan(params).promise()
    const { ConsumedCapacity, Items } = result
    assert(Array.isArray(Items))
    if (Items.length) {
      assert.strictEqual(Items.length, 1)
      const [firstItem] = Items
      return firstItem
    }
  }

  const scanBaseChainId = async () => {
    if (baseChainItem) {
      // TODO move caching to consistency
      return baseChainItem
    }
    const result = await _scanFirst('dbChains')
    if (result) {
      baseChainItem = result
    }
    return baseChainItem
  }
  const scanKeypair = async () => _scanFirst('dbCrypto')

  return {
    putPool,
    putBlock,
    putSubscriptions,
    putSocket,

    delSubscriptions,
    delPool,

    getBlock,

    queryAffected,
    querySockets,
    queryLatest,
    queryPool,

    scanBaseChainId,

    scanKeypair,
    putKeypair,

    putPierce,
    queryPiercings,
    delPierce,
  }
}

export { dbFactory }
