const assert = require('assert')
const { actionModel } = require('..')

describe('acl', () => {
  test('creates default', () => {
    const action = actionModel.create()
    assert(action)
    assert(actionModel.isModel(action))
    const clone = actionModel.clone()
    assert(clone)
    assert(actionModel.isModel(clone))
    assert(action.type.startsWith('DEFAULT_ACTION_'))
  })
  test('create is same as clone', () => {
    const action = actionModel.create('test')
    const create = actionModel.create(action)
    const clone = actionModel.clone(create)
    assert(action.equals(create))
    assert(create.equals(clone))
  })
  test('create is always a different object', () => {
    const a1 = actionModel.create()
    const a2 = actionModel.create()
    assert(a1.type.startsWith('DEFAULT_ACTION_'))
    assert(a2.type.startsWith('DEFAULT_ACTION_'))
    assert(!a1.equals(a2))
  })
  test('no undefined in payloads', () => {
    const original = { type: 'test', payload: { missing: undefined } }
    assert.throws(() => actionModel.create(original))
    const nested = { type: 'test', payload: { deep: { missing: undefined } } }
    assert.throws(() => actionModel.create(nested))
  })
})
