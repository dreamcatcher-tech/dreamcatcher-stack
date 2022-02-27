import { assert } from 'chai/index.mjs'
import { Action } from '../../src/ipld/Action'
import { RawBinary } from '../../src/ipld/RawBinary'
import { BlockFactory } from '../../src/CIDFactory'

describe.only('Action', () => {
  test('throws on blank creation', () => {
    assert.throws(Action.create)
  })
  test('creates default', () => {
    const action = Action.create('action1')
    assert(action)
  })
  test('no undefined in payloads', () => {
    const original = { type: 'test', payload: { missing: undefined } }
    assert.throws(() => Action.create(original))
    const nested = { type: 'test', payload: { deep: { missing: undefined } } }
    assert.throws(() => Action.create(nested))
  })
  test('payload must be POJO', () => {
    const complexObject = Action.create('COMPLEX')
    const msg = 'payload not POJO'
    assert.throws(() => Action.create('TYPE', complexObject), msg)
    assert.throws(() => Action.create('@@RESOLVE', { complexObject }), msg)
  })
  test('with binary', async () => {
    const block = await BlockFactory({ type: 'test' })
    const binary = await RawBinary.create(block.bytes)
    const action = Action.create('TYPE', {}, binary)
    assert(action.binary instanceof RawBinary)
  })
  test('action is frozen', async () => {
    const block = await BlockFactory({ type: 'test' })
    const binary = await RawBinary.create(block.bytes)
    const action = Action.create('TYPE', {}, binary)
    assert.throws(() => (action.type = 'tamper'), 'Cannot assign to read only')
    assert.throws(() => (binary.type = 'tamper'), 'Cannot add property type')
    assert.throws(() => (binary.cid = 'tamper'), 'Cannot set property cid')
  })
  test('encode decode', async () => {
    const block = await BlockFactory({ type: 'test' })
    const binary = await RawBinary.create(block.bytes)
    const action = Action.create('TYPE', { some: 'thing' }, binary)
    const crushedAction = await action.crush()
    assert.strictEqual(crushedAction.crushedSize, 79)

    const diffBlocks = crushedAction.getDiffBlocks()
    assert(Array.isArray(diffBlocks))
    assert.strictEqual(diffBlocks.length, 2)
    assert.strictEqual(crushedAction.getDiffBlocks(crushedAction).length, 0)

    const resolver = (cid) => diffBlocks.find((block) => block.cid === cid)
    const rootCid = diffBlocks[0].cid
    const revived = await Action.uncrush(rootCid, resolver)
    assert(crushedAction !== revived) // TODO make a cache so objects are equal
    assert.deepEqual(crushedAction, revived)
  })
  test('deduplication by hash', async () => {
    const action1 = Action.create('TYPE', { some: 'thing' })
    const action2 = Action.create('TYPE', { some: 'thing' })
    assert(action1 !== action2)
    const crushed1 = await action1.crush()
    const crushed2 = await action2.crush()
    assert.deepEqual(crushed1, crushed2)
    // assert.strictEqual(crushed1, crushed2)
    // disable the crush cache, then show that the actions are different
  })
})
