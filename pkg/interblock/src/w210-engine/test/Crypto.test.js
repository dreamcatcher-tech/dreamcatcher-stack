import delay from 'delay'
import assert from 'assert-fast'
import { Address } from '../../w008-ipld'
import { Crypto, CryptoLock } from '../src/Crypto'
import Debug from 'debug'
const debug = Debug('interblock:tests:Crypto')

describe('Crypto', () => {
  test('locks', async () => {
    const crypto = Crypto.createCI()
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
    const crypto = Crypto.createCI()
    const address = Address.createCI('locktest')
    const lock1 = await crypto.lock(address)
    const lock2Promise = crypto.lock(address)
    const lock3Promise = crypto.lock(address)
    const token = Symbol('delay')
    const delay1 = delay(5).then(() => token)
    const result1 = await Promise.race([lock2Promise, delay1])
    assert.strictEqual(result1, token)

    lock1.release()
    const lock2 = await lock2Promise
    assert(lock2 instanceof CryptoLock)

    const delay2 = delay(5).then(() => token)
    const result2 = await Promise.race([lock3Promise, delay2])
    assert.strictEqual(result2, token)

    lock2.release()
    const lock3 = await lock3Promise
    assert(lock3 instanceof CryptoLock)
    lock3.release()
  })
})
