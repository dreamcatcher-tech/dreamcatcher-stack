import { assert } from 'chai/index.mjs'
import { Request, Binary } from '../../src/ipld'
import { fromString } from 'uint8arrays/from-string'

describe('Request', () => {
  test('throws on blank creation', () => {
    assert.throws(Request.create)
  })
  test('creates default', () => {
    const action = Request.create('action1')
    assert(action)
  })
  test('no undefined in payloads', () => {
    const original = { type: 'test', payload: { missing: undefined } }
    assert.throws(() => Request.create(original))
    const nested = { type: 'test', payload: { deep: { missing: undefined } } }
    assert.throws(() => Request.create(nested))
  })
  test('payload must be POJO', () => {
    const complexObject = Request.create('COMPLEX')
    const msg = 'payload not POJO'
    assert.throws(() => Request.create('TYPE', complexObject), msg)
    assert.throws(() => Request.create('@@RESOLVE', { complexObject }), msg)
  })
  test('with binary', async () => {
    const bytes = fromString('with binary')
    const binary = await Binary.create(bytes)
    const action = Request.create('TYPE', {}, binary)
    assert(action.binary instanceof Binary)
  })
  test('action is frozen', async () => {
    const bytes = fromString('action is frozen')
    const binary = await Binary.create(bytes)
    const action = Request.create('TYPE', {}, binary)
    assert.throws(() => (action.type = 'tamper'), 'Cannot assign to read only')
    assert.throws(() => (binary.type = 'tamper'), 'Cannot add property type')
    assert.throws(() => (binary.cid = 'tamper'), 'Cannot set property cid')
  })
  test('encode decode', async () => {
    const bytes = fromString('encode decode')
    const binary = await Binary.create(bytes)
    const request = Request.create('TYPE', { some: 'thing' }, binary)
    const crushedRequest = await request.crush()
    assert.strictEqual(crushedRequest.crushedSize, 79)

    const diffBlocks = crushedRequest.getDiffBlocks()
    assert(diffBlocks instanceof Map)
    assert.strictEqual(diffBlocks.size, 2)
    assert.strictEqual(crushedRequest.getDiffBlocks(crushedRequest).size, 0)

    const resolver = (cid) => diffBlocks.get(cid.toString())
    const rootCid = crushedRequest.cid
    const revived = await Request.uncrush(rootCid, resolver)
    assert(crushedRequest !== revived) // TODO make a cache so objects are equal
    assert.deepEqual(crushedRequest, revived)
  })
  test('deduplication by hash', async () => {
    const action1 = Request.create('TYPE', { some: 'thing' })
    const action2 = Request.create('TYPE', { some: 'thing' })
    assert(action1 !== action2)
    const crushed1 = await action1.crush()
    const crushed2 = await action2.crush()
    assert.deepEqual(crushed1, crushed2)
    // assert.strictEqual(crushed1, crushed2)
    // disable the crush cache, then show that the actions are different
  })
})
