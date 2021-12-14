import { assert } from 'chai/index.mjs'
import { Action } from '../../src/classes'

describe('acl', () => {
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
})
