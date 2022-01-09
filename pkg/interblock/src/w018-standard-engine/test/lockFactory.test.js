import { assert } from 'chai/index.mjs'
import { lockFactory } from '../src/services/consistencyFactory/lockFactory'
import levelmem from 'level-mem'

describe('lockFactory', () => {
  test('cannot acquire lock twice in order', async () => {
    const chainId = 'testChainId'
    const awsRequestId = 'testAwsRequestId'
    const db = levelmem()
    const lock = lockFactory(db)
    const uuid = await lock.tryAcquire(chainId, awsRequestId)
    assert(uuid)
    const uuidDenied = await lock.tryAcquire(chainId, awsRequestId)
    assert(!uuidDenied)
  })
  test('cannot acquire lock twice', async () => {
    const chainId = 'testChainIdTwice'
    const awsRequestId = 'testAwsRequestId'
    const db = levelmem()
    const lock = lockFactory(db)
    const p1 = lock.tryAcquire(chainId, awsRequestId)
    const p2 = lock.tryAcquire(chainId, awsRequestId)
    const uuid1 = await p1
    const uuid2 = await p2
    assert((uuid1 && !uuid2) || (!uuid1 && !uuid2))
  })
  test('can acquire lock after release', async () => {
    const chainId = 'testChainIdRelease'
    const awsRequestId = 'testAwsRequestId'
    const db = levelmem()
    const lock = lockFactory(db)
    const uuid = await lock.tryAcquire(chainId, awsRequestId)
    assert(uuid)
    await lock.release(chainId, uuid)
    const uuidSecond = await lock.tryAcquire(chainId, awsRequestId)
    assert(uuidSecond)
  })
})
