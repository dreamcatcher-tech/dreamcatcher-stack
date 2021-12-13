import { assert } from 'chai/index.mjs'
import { Address, Integrity, RxRequest } from '../../src/classes'

describe.only('rxRequest', () => {
  test('addresses are identical', () => {
    const knownIntegrity = Integrity.create('test address')
    const address = Address.create(knownIntegrity)
    assert(!address.isLoopback())
    assert(!address.isUnknown())
    const request = RxRequest.create('test', {}, address, 55, 20)
    const requestAddress = request.getAddress()
    assert(requestAddress instanceof Address)
    assert(!requestAddress.isLoopback())
    assert(!requestAddress.isUnknown())
    assert(!requestAddress.isInvalid())
    assert(address.deepEquals(requestAddress))
  })
  test('unknown or invalid addresses are not allowed', () => {
    const unknown = Address.create()
    assert(unknown.isUnknown())
    assert.throws(() => RxRequest.create('test', {}, unknown, 55, 20))
    const invalid = Address.create('INVALID')
    assert(invalid.isInvalid())
    assert.throws(() => RxRequest.create('test', {}, invalid, 55, 20))
  })
  test('loopback rxRequest returns correct address', () => {
    const address = Address.create('LOOPBACK')
    assert(address.isLoopback())
    assert(!address.isUnknown())
    const request = RxRequest.create('test', {}, address, 55, 20)
    const requestAddress = request.getAddress()
    assert(requestAddress.isLoopback())
    assert(!requestAddress.isUnknown())
    assert(address.deepEquals(requestAddress))
  })
})
