import assert from 'assert-fast'
import { Address } from '../../w008-ipld'
import { Crypto, CryptoLock } from '../src/Crypto'
import Debug from 'debug'
const debug = Debug('interblock:tests:Crypto')

describe('Crypto', () => {
  test('locks', async () => {
    const crypto = new Crypto()
    const address = Address.createCI('locktest')
    const lock1 = await crypto.lock(address)
    assert(lock1 instanceof CryptoLock)
    const lock2Promise = crypto.lock(address)
    const delay = new Promise((r) => setTimeout(r, 50))
    const result = await Promise.race([lock2Promise, delay])
    assert(!(result instanceof CryptoLock))

    lock1.release()
    const lock2 = await lock2Promise
    assert(lock2 instanceof CryptoLock)
  })
  test('multiple locks', async () => {
    const crypto = new Crypto()
    const address = Address.createCI('locktest')
    const lock1 = await crypto.lock(address)
    const lock2Promise = crypto.lock(address)
    const lock3Promise = crypto.lock(address)
    const delay1 = new Promise((r) => setTimeout(r, 5))
    const result1 = await Promise.race([lock2Promise, delay1])
    assert(!(result1 instanceof CryptoLock))

    lock1.release()
    const lock2 = await lock2Promise
    assert(lock2 instanceof CryptoLock)

    const delay2 = new Promise((r) => setTimeout(r, 5))
    const result2 = await Promise.race([lock3Promise, delay2])
    assert(!(result2 instanceof CryptoLock))

    lock2.release()
    const lock3 = await lock3Promise
    assert(lock3 instanceof CryptoLock)
    lock3.release()
  })
})
