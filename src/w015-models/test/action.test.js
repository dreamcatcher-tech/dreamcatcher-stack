import assert from 'assert'
const { actionModel } = require('..')

describe('acl', () => {
  test('throws on blank creation', () => assert.throws(actionModel.create))
  test('throws on blank clone', () => assert.throws(actionModel.clone))
  test('creates default', () => {
    const action = actionModel.create('action1')
    assert(action)
    assert(actionModel.isModel(action))
  })
  test('create is same as clone', () => {
    const action = actionModel.create('test')
    const create = actionModel.create(action)
    const clone = actionModel.clone(create)
    assert(action.equals(create))
    assert(create.equals(clone))
  })
  test('no undefined in payloads', () => {
    const original = { type: 'test', payload: { missing: undefined } }
    assert.throws(() => actionModel.create(original))
    const nested = { type: 'test', payload: { deep: { missing: undefined } } }
    assert.throws(() => actionModel.create(nested))
  })
})
