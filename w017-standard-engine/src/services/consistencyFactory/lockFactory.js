const debug = require('debug')('interblock:aws:lock')
const DynamoDBLockClient = require('dynamodb-lock-client')
const { promisify } = require('util')
const {} = require('./ramDynamoDbFactory')
const lockFactory = (dynamodb = ramDynamoDbFactory()) => {
  const locks = new Map()

  const tryAcquire = async (chainId, awsRequestId, expiryMs) => {
    if (locks.has(chainId)) {
      debug(`already locked to this thread: ${chainId}`)
      return
    }
    const failOpen = new DynamoDBLockClient.FailOpen({
      dynamodb,
      lockTable: 'dbLocks',
      partitionKey: 'chainId',
      leaseDurationMs: expiryMs || 12e3,
      retryCount: 0,
      owner: awsRequestId,
      trustLocalTime: true,
      // heartbeatPeriodMs: 3e2,
    })
    try {
      const currentLock = await _dbGet('dbLocks', { chainId })
      // debug(`currentLock: %O`, currentLock)
      if (currentLock && currentLock.leaseDurationMs !== 1) {
        const acquired = currentLock.lockAcquiredTimeUnixMs
        const duration = currentLock.leaseDurationMs
        const graceMs = 2e3
        const isExpired = Date.now() - acquired > duration + graceMs
        if (!isExpired) {
          debug(`lock not available ${chainId}`)
          return
        }
      }

      const acquireLock = promisify(failOpen.acquireLock).bind(failOpen)
      debug(`attempting to lock ${chainId}`)
      const dynamoDbLock = await acquireLock(chainId)
      // TODO fail if gets acquired already - ie: do not wait for it ?
      const { fencingToken } = dynamoDbLock
      debug(`locked ${chainId} with fencing token: ${fencingToken}`)
      const tryRelease = async () => {
        try {
          const release = promisify(dynamoDbLock.release).bind(dynamoDbLock)
          await release()
          debug(`released lock for ${chainId}`)
        } catch (e) {
          debug(`failed to release lock for ${chainId} ${e.message}`)
        }
      }
      const uuid = dynamoDbLock._guid.toString('base64')
      const hardwareLock = { uuid, tryRelease }
      locks.set(chainId, hardwareLock)
      debug(`lock complete`)
      return uuid
    } catch (error) {
      debug(`failed to lock: ${chainId} %O`, error)
      return
    }
  }

  const isValid = async (chainId, uuid) => {
    // TODO check lock has not expired
    await Promise.resolve()
    if (!locks.has(chainId)) {
      debug(`unknown lock for ${chainId}`)
      return false
    }
    const hardwareLock = locks.get(chainId)
    return hardwareLock.uuid === uuid
  }

  const release = async (chainId, uuid) => {
    const hardwareLock = locks.get(chainId)
    if (hardwareLock.uuid === uuid) {
      await hardwareLock.tryRelease()
      locks.delete(chainId)
      return
    }
    throw new Error(`invalid lock: ${chainId} ${uuid}`)
  }

  const _dbGet = async (TableName, Key) => {
    // TODO move to using dbFactory ?
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

  return { tryAcquire, isValid, release }
}

module.exports = { lockFactory }
