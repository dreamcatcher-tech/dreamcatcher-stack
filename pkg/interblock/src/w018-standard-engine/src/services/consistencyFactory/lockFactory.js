import Debug from 'debug'
import { ramDynamoDbFactory } from './ramDynamoDbFactory'

let instanceId = 0
let ramLockId = 1
const lockFactory = (dynamodb = ramDynamoDbFactory()) => {
  const debug = Debug(`interblock:aws:lock:id-${instanceId++}`)

  const locks = new Map()
  const tryAcquire = async (chainId, awsRequestId, expiryMs) => {
    debug(
      `attempting to lock %o %o %o`,
      chainId.substring(0, 16),
      awsRequestId,
      expiryMs
    )
    if (locks.has(chainId)) {
      debug(`already locked to this thread: ${chainId}`)
      return
    }
    if (dynamodb._getTables) {
      const uuid = 'ramLockId-' + ramLockId++
      const hardwareLock = {
        uuid,
        tryRelease() {
          debug(`ram tryRelease for uuid: %o and chainId: %o`, uuid, chainId)
        },
      }
      locks.set(chainId, hardwareLock)
      return uuid
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

  return { tryAcquire, isValid, release }
}

export { lockFactory }
