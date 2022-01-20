import { assert } from 'chai/index.mjs'
import { Continuation, Integrity } from '..'
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
  test('payload must be POJO', () => {
    const integrity = Integrity.create('Complex object')
    const msg = 'payload must be stringifiable'
    assert.throws(() => Continuation.create('@@RESOLVE', integrity), msg)
    assert.throws(() => Continuation.create('@@RESOLVE', { integrity }), msg)
  })
})
