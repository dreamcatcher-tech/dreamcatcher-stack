import { assert } from 'chai/index.mjs'
import { Continuation } from '../../src/classes'
describe('continuation', () => {
  test('promise cannot have payload', () => {
    const resolve = Continuation.create('@@RESOLVE', {
      some: 'payload',
    })
    const reject = Continuation.create('@@REJECT', {
      some: 'payload',
    })
    assert.throws(() => Continuation.create('@@PROMISE', { some: 'payload' }))
    assert.throws(() => Continuation.create('@@RESOLVE', 'not an object'))
    assert.throws(() => Continuation.create('@@REJECT', 'not an object'))
    assert(resolve)
    assert(reject)
  })
})
