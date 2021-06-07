const debug = require('debug')('interblock:aws:ramDynamoDb')
const assert = require('assert')
const _ = require('lodash')
const setImmediate = require('set-immediate-shim')

const ramDynamoDbFactory = () => {
  const tables = {
    dbCrypto: {},
    dbChains: {},
    dbPools: {},
    dbLocks: {},
    dbSubscribers: {},
    dbSockets: {},
    dbPiercings: {},
  }

  const get = ({ TableName, Key }, callback) => {
    debug(`get %O callback: %O`, TableName, callback)
    assert(tables[TableName])

    if (callback) {
      setImmediate(async () => {
        callback(null, await ret.promise())
      })
    }

    const ret = {
      promise: async () => {
        await Promise.resolve()
        assert(Key.chainId)
        const partition = tables[TableName][Key.chainId] || {}
        const rangeKey = getRangeKey(TableName, Key)
        const Item = partition[rangeKey]
        // debug(`get: %O %O`, TableName, tables[TableName])
        return { Item }
      },
    }
    return ret
  }
  const query = (params) => {
    debug(`query %O`, params.TableName)
    const { TableName, KeyConditionExpression, ExpressionAttributeValues } =
      params
    assert.strictEqual(KeyConditionExpression, 'chainId = :hkey')
    const chainId = ExpressionAttributeValues[':hkey']
    assert(chainId)

    return {
      promise: async () => {
        await Promise.resolve()
        const partition = tables[TableName][chainId] || {}

        const Items = Object.values(partition).reverse()
        return { Items }
      },
    }
  }
  const del = ({ TableName, Key }) => {
    debug(`del %O %O`, TableName, Key)
    return {
      promise: async () => {
        await Promise.resolve()
        const partition = tables[TableName][Key.chainId]
        const rangeKey = getRangeKey(TableName, Key)
        const item = partition[rangeKey]
        assert(item, `cannot delete non existent item`)
        delete partition[rangeKey]
      },
    }
  }

  const put = ({ TableName, Item, ...rest }, callback) => {
    debug(`put %O %O`, TableName, Item.chainId)
    if (callback) {
      setImmediate(async () => {
        try {
          const result = await ret.promise()
          callback(null, result)
        } catch (e) {
          callback(e)
        }
      })
    }

    const ret = {
      promise: async () => {
        await Promise.resolve()
        const { chainId } = Item
        const partition = tables[TableName][chainId] || {}
        const rangeKey = getRangeKey(TableName, Item)
        if (partition[rangeKey]) {
          debug(`already exists: %O`, Item.chainId)
        }
        partition[rangeKey] = Item
        tables[TableName][chainId] = partition
        return true
      },
    }
    return ret
  }

  const scan = ({ TableName, Limit }) => {
    debug(`scan: %O %O`, TableName, Limit)
    assert(['dbChains', 'dbCrypto'].includes(TableName))
    assert.strictEqual(Limit, 1)
    return {
      promise: async () => {
        await Promise.resolve()
        const table = tables[TableName]
        const firstPartition = Object.values(table)[0]
        let Items = []
        if (firstPartition) {
          Items.push(Object.values(firstPartition)[0])
        }
        return { Items }
      },
    }
  }

  const _getTables = () => tables
  return { get, query, delete: del, put, scan, _getTables }
}

const rangeKeyMap = {
  dbChains: 'height',
  dbPools: 'originChainId_height_type',
  dbLocks: 'chainId',
  dbSockets: 'socketId',
  dbSubscribers: 'targetChainId',
  dbPiercings: 'hash',
}
const getRangeKey = (tableName, item) => {
  const rangeKeyName = rangeKeyMap[tableName]
  return item[rangeKeyName]
}

module.exports = { ramDynamoDbFactory }
