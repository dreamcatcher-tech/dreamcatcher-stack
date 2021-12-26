import { assert } from 'chai/index.mjs'
import { consistencySourceFactory } from '../src/services/consistencyFactory'
import levelup from 'levelup'
import memdown from 'memdown'
import { Address, Block, Lock } from '../../w015-models'
import { v4 } from 'uuid'
import { Integrity } from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:tests:consistency')
Debug.enable()

describe('consistency', () => {
  const lockExpiresMs = 2
  const consistencySource = consistencySourceFactory()
  describe('putPoolInterblocks', () => {
    test.todo('duplicates discarded')
  })
  describe('lockChain', () => {
    test('lock for undefined block', async () => {
      const address = Address.create('TEST')
      const lock = await consistencySource.putLockChain(address, lockExpiresMs)
      assert(lock)
    })
    test.todo('failed lock can be claimed after expiry')
    test('lock cached', async () => {
      const integrity = Integrity.create(v4())
      const address = Address.create(integrity)
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
    test('lock is exclusive between consistency sources', async () => {
      const address = Address.create('TEST')
      const db = levelup(memdown())
      const source1 = consistencySourceFactory(db)
      const source2 = consistencySourceFactory(db)

      const lock1 = await source1.putLockChain(address, lockExpiresMs)
      const lock2 = await source2.putLockChain(address, lockExpiresMs)
      assert(lock1)
      assert(!lock2)
    })
    test.todo('no attempt to unlock if expired')
    test('includes block', async () => {
      const block = Block.create()
      const address = block.provenance.getAddress()
      const lock = await consistencySource.putLockChain(address)
      assert(lock)
      assert(!lock.block)
      const incomingLock = lock.update({ block })
      await consistencySource.putUnlockChain(incomingLock)
      const nextLock = await consistencySource.putLockChain(address)
      assert(nextLock)
      assert(nextLock.block.deepEquals(block))
      await consistencySource.putUnlockChain(nextLock)
    })
  })
  describe('unlockChain', () => {})
  describe('isPresent', () => {
    test('non existent chainId', async () => {
      const address = Address.create('TEST')
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
