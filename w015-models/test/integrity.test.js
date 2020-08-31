const assert = require('assert')
const { integrityModel } = require('../../w015-models')

describe('integrity', () => {
  test('stable hashing when object keys shuffle', () => {
    const forward = { one: 1, two: 2 }
    const reverse = { two: 2, one: 1 }
    const fi = integrityModel.create(forward)
    const ri = integrityModel.create(reverse)
    assert(fi === ri)
  })
  test('no params returns unknown integrity', () => {
    const unknown = integrityModel.create()
    assert(unknown.isUnknown())
    const clone = integrityModel.clone()
    assert(clone.isUnknown())
  })
  test('strings hash too', () => {
    // TODO might make some tests easier if sugared to accept strings ?
    const fromString = integrityModel.create('string')
    assert(!fromString.isUnknown())
    const obj = integrityModel.create({ random: 'object' })
    assert(!obj.isUnknown())
  })
  test('check passes for equivalent objects', () => {
    const obj = integrityModel.create({ random: 'object' })
    assert(!obj.isIntegrityMatch({ not: 'same' }))
    assert(obj.isIntegrityMatch({ random: 'object' }))
  })
  test('handles null keys', () => {
    const mockBlock = { top: null, fart: null }
    const mock = integrityModel.create(mockBlock)
    assert(mock)
  })
  test('handles two undefined keys', () => {
    const mockBlock = { top: undefined, bottom: undefined }
    const mock = integrityModel.create(mockBlock)
    assert(mock)
  })
  test('handles empty objects', () => {
    const integrity = integrityModel.create({})
    assert(integrity && !integrity.isUnknown())
    const duplicate = integrityModel.create({})
    assert(duplicate === integrity)
    assert(integrity.isIntegrityMatch({}))
  })
  test(`getHash returns the stored hash`, () => {
    const integrity = integrityModel.create('test hash')
    assert.equal(integrity.hash, integrity.getHash())
  })
  test.todo('detects tampered proof')
  test.todo('detects tampered nested proof')
})
