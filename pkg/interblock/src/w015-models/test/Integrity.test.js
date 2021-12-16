import { assert } from 'chai/index.mjs'
import { Integrity } from '..'

describe('integrity', () => {
  test('stable hashing when object keys shuffle', () => {
    const forward = { one: 1, two: 2 }
    const reverse = { two: 2, one: 1 }
    const fi = Integrity.create(forward)
    const ri = Integrity.create(reverse)
    assert(fi.deepEquals(ri))
  })
  test('no params returns unknown integrity', () => {
    const unknown = Integrity.create()
    assert(unknown.isUnknown())
    const clone = Integrity.restore(unknown.toArray())
    assert(clone.isUnknown())
  })
  test('strings hash too', () => {
    // TODO might make some tests easier if sugared to accept strings ?
    const fromString = Integrity.create('string')
    assert(!fromString.isUnknown())
    const obj = Integrity.create({ random: 'object' })
    assert(!obj.isUnknown())
  })
  test('check passes for equivalent objects', () => {
    const obj = Integrity.create({ random: 'object' })
    assert(!obj.isIntegrityMatch({ not: 'same' }))
    assert(obj.isIntegrityMatch({ random: 'object' }))
  })
  test('handles null keys', () => {
    const mockBlock = { top: null, fart: null }
    const mock = Integrity.create(mockBlock)
    assert(mock)
  })
  test('handles two undefined keys', () => {
    const mockBlock = { top: undefined, bottom: undefined }
    const mock = Integrity.create(mockBlock)
    assert(mock)
  })
  test('handles empty objects', () => {
    const integrity = Integrity.create({})
    assert(integrity && !integrity.isUnknown())
    const duplicate = Integrity.create({})
    assert(duplicate.deepEquals(integrity))
    assert(integrity.isIntegrityMatch({}))
  })
  test(`getHash returns the stored hash`, () => {
    const integrity = Integrity.create('test hash')
    assert.strictEqual(integrity.hash, integrity.hashString())
  })
  test.todo('detects tampered proof')
  test.todo('detects tampered nested proof')
})
