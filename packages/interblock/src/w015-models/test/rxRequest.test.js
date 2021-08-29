import { assert } from 'chai/index.mjs'
import { addressModel, rxRequestModel, integrityModel } from '..'

describe('rxRequest', () => {
  test('addresses are identical', () => {
    const knownIntegrity = integrityModel.create('test address')
    const address = addressModel.create(knownIntegrity)
    assert(!address.isLoopback())
    assert(!address.isUnknown())
    const request = rxRequestModel.create('test', {}, address, 55)
    const requestAddress = request.getAddress()
    assert(!requestAddress.isLoopback())
    assert(!requestAddress.isUnknown())
    assert(!requestAddress.isInvalid())
    assert(address.equals(requestAddress))
  })
  test('unknown or invalid addresses are not allowed', () => {
    const unknown = addressModel.create()
    assert(unknown.isUnknown())
    assert.throws(() => rxRequestModel.create('test', {}, unknown, 55))
    const invalid = addressModel.create('INVALID')
    assert(invalid.isInvalid())
    assert.throws(() => rxRequestModel.create('test', {}, invalid, 55))
  })
  test('loopback sequence returns correct address', () => {
    const address = addressModel.create('LOOPBACK')
    assert(address.isLoopback())
    assert(!address.isUnknown())
    const request = rxRequestModel.create('test', {}, address, 55)
    const requestAddress = request.getAddress()
    assert(requestAddress.isLoopback())
    assert(!requestAddress.isUnknown())
    assert(address.equals(requestAddress))
  })
})
