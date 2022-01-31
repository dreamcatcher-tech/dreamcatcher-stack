import { assert } from 'chai/index.mjs'
import { Action, Integrity } from '..'

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
  test('payload must be POJO', () => {
    const integrity = Integrity.create('Complex object')
    const msg = 'payload not POJO'
    assert.throws(() => Action.create('TYPE', integrity), msg)
    assert.throws(() => Action.create('@@RESOLVE', { integrity }), msg)
  })
})
