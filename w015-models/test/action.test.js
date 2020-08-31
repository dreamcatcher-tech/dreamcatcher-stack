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
    assert(action.type === 'DEFAULT_ACTION')
  })
  test('create is same as clone', () => {
    const action = actionModel.create('test')
    const create = actionModel.create(action)
    const clone = actionModel.clone(create)
    assert(action === create)
    assert(create === clone)
  })
  test('create is always the same object', () => {
    const a1 = actionModel.create()
    const a2 = actionModel.create()
    assert(a1 === a2)
  })
})
