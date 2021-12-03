import { assert } from 'chai/index.mjs'
import { State } from '../../src/classes'

// TODO add in the covenant api tools, and make some actions

describe('state', () => {
  describe('create', () => {
    test('default', () => {
      const state = State.create()
      assert(state)
    })
    test.todo('create with actions but no defaultAction passes')
  })
  test('equality', () => {
    const s1 = State.create()
    const s2 = State.create()
    assert(s1.equals(s2))
    const s3 = State.create({ some: 'object' })
    const s4 = State.create({ some: 'object' })
    assert(s3.equals(s4))
    const s5 = State.create({ some: 'object' })
    const s6 = State.create({ some: 'different object' })
    assert(!s5.equals(s6))
  })
  test('no undefined state keys during serialize', () => {
    assert(State.create({ not: 'missing' }).toArray())
    assert.throws(() => State.create({ missing: undefined }))
    assert.throws(() => State.create({ n: { m: undefined } }))
    assert.throws(() => State.create(null))
    assert(State.create({ n: { m: null } }))
  })
  test.todo('logically wrong action identifiers')
  test.todo('identifier pattern wrong')
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
