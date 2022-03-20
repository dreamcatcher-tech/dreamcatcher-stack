import { assert } from 'chai/index.mjs'
import { Request, Binary } from '..'
import { fromString } from 'uint8arrays/from-string'

describe('Request', () => {
  test('throws on blank creation', () => {
    assert.throws(Request.create, 'cannot be undefined')
  })
  test('creates default', () => {
    const request = Request.create('TEST_REQUEST')
    assert(request)
    assert.strictEqual(request.type, 'TEST_REQUEST')
  })
  test('no undefined in payloads', () => {
    const original = { type: 'test', payload: { missing: undefined } }
    assert.throws(() => Request.create(original), 'undefined')
    const nested = { type: 'test', payload: { deep: { missing: undefined } } }
    assert.throws(() => Request.create(nested), 'undefined')
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
    const request = Request.create('TYPE', {}, binary)
    assert(request.binary instanceof Binary)
  })
  test('action is frozen', async () => {
    const bytes = fromString('request is frozen')
    const binary = await Binary.create(bytes)
    const request = Request.create('TYPE', {}, binary)
    assert.throws(() => (request.type = 'tamper'), 'Cannot assign to read only')
    assert.throws(() => (binary.type = 'tamper'), 'Cannot add property type')
    assert.throws(() => (binary.cid = 'tamper'), 'Cannot set property cid')
  })
  test('encode decode', async () => {
    const bytes = fromString('test encode decode')
    const binary = await Binary.create(bytes)
    const request = Request.create('TYPE', { some: 'thing' }, binary)
    const crushedRequest = await request.crush()
    assert.strictEqual(crushedRequest.crushedSize, 79)

    const diffBlocks = await crushedRequest.getDiffBlocks()
    assert(diffBlocks instanceof Map)
    assert.strictEqual(diffBlocks.size, 2)

    const resolver = (cid) => diffBlocks.get(cid.toString())
    const rootCid = crushedRequest.cid
    const revived = await Request.uncrush(rootCid, resolver)
    assert(crushedRequest !== revived) // TODO make a cache so objects are equal
    assert.deepEqual(crushedRequest, revived)
  })
  test('deduplication by hash', async () => {
    const request1 = Request.create('TYPE', { some: 'thing' })
    const request2 = Request.create('TYPE', { some: 'thing' })
    assert(request1 !== request2)
    const crushed1 = await request1.crush()
    const crushed2 = await request2.crush()
    assert.deepEqual(crushed1, crushed2)
    // assert.strictEqual(crushed1, crushed2)
    // disable the crush cache, then show that the actions are different
  })
})
