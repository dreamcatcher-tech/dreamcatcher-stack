import { assert } from 'chai/index.mjs'
import {
  ramDynamoDbFactory,
  consistencySourceFactory,
} from '../src/services/consistencyFactory'
import { addressModel, blockModel, lockModel } from '../../w015-models'
import { v4 } from 'uuid'
import { integrityModel } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:tests:consistency')
Debug.enable()

describe('consistency', () => {
  const lockExpiresMs = 2
  const consistencySource = consistencySourceFactory()
  describe('putPoolInterblocks', () => {
    test.todo('duplicates discarded')
    test.todo('light does not displace heavy')
  })
  describe('lockChain', () => {
    test('lock for undefined block', async () => {
      const address = addressModel.create('TEST')
      const lock = await consistencySource.putLockChain(address, lockExpiresMs)
      assert(lock)
    })
    test.todo('failed lock can be claimed after expiry')
    test('lock cached', async () => {
      const integrity = integrityModel.create(v4())
      const address = addressModel.create(integrity)
      const lock = await consistencySource.putLockChain(address, lockExpiresMs)
      assert(lock)
      const start = Date.now()
      const lockFailed = await consistencySource.putLockChain(address)
      assert(!lockFailed)
      const delay = Date.now() - start
      debug(`delay: %O`, delay)
      const ramDelayMs = 10
      assert(delay < ramDelayMs)
    })
    test.skip('lock is exclusive between consistency sources', async () => {
      //TODO re-enable when have pure locking model built
      const address = addressModel.create('TEST')
      const db = ramDynamoDbFactory()
      delete db._getTables // skip the ram db optimization
      const source1 = consistencySourceFactory(db)
      const source2 = consistencySourceFactory(db)

      const lock1 = await source1.putLockChain(address, lockExpiresMs)
      const lock2 = await source2.putLockChain(address, lockExpiresMs)
      assert(lock1)
      assert(!lock2)
    })
    test.todo('no attempt to unlock if expired')
    test('includes block', async () => {
      const block = await blockModel.create()
      const address = block.provenance.getAddress()
      const lock = await consistencySource.putLockChain(address)
      assert(lock)
      assert(!lock.block)
      const incomingLock = lockModel.clone({ ...lock, block })
      await consistencySource.putUnlockChain(incomingLock)
      const nextLock = await consistencySource.putLockChain(address)
      assert(nextLock)
      assert(nextLock.block.equals(block))
      await consistencySource.putUnlockChain(nextLock)
    })
  })
  describe('unlockChain', () => {})
  describe('isPresent', () => {
    test('non existent chainId', async () => {
      const address = addressModel.create('TEST')
      const isPresent = await consistencySource.getIsPresent(address)
      assert(!isPresent)
    })
    test.todo(`existing chainId`)
    test.todo('unknown address rejected')
  })
  describe('latest', () => {})
  describe('socketsForAddress', () => {})
  describe('storeConnection', () => {})
  describe('block', () => {})
})
