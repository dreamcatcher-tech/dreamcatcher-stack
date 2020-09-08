const assert = require('assert')
const { stateModel } = require('..')
const { request, promise, resolve, reject } = require('../../w002-api')

// TODO add in the covenant api tools, and make some actions

describe('state', () => {
  describe('create', () => {
    test('default', () => {
      const state = stateModel.create()
      assert(!state.getRequests().length)
      assert(!state.getReplies().length)
    })
    test.todo('create with actions but no defaultAction passes')
  })
  test('clone', () => {
    const s1 = stateModel.clone()
    const s2 = stateModel.create()
    assert(s1.equals(s2))
  })
  test('no undefined state keys', () => {
    assert(stateModel.create({ not: 'missing' }))
    assert.throws(() => stateModel.create({ missing: undefined }))
    assert.throws(() => stateModel.create({ nested: { missing: undefined } }))
  })
  test.todo('logically wrong action sequences')
  test.todo('sequence pattern wrong')
  test.todo('state non serializable')
  test.todo('actions non serializable')
  describe('logicize', () => {
    describe('reply', () => {
      test.todo('only one promise per batch')
      test.todo('promise cannot have request key')
      test.todo('all replies at to different addresses')
      test.todo('only one reply uses empty request address')
      test.todo('the single promise is only to the default action')
    })
    describe('request', () => {
      test.todo('no to address defaults to self')
    })
  })
})
