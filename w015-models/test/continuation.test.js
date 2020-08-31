const assert = require('assert')
const { continuationModel } = require('..')
describe('continuation', () => {
  test('promise cannot have payload', () => {
    const resolve = continuationModel.create('@@RESOLVE', {
      some: 'payload',
    })
    const reject = continuationModel.create('@@REJECT', {
      some: 'payload',
    })
    assert.throws(() =>
      continuationModel.create('@@PROMISE', { some: 'payload' })
    )
    assert.throws(() => continuationModel.create('@@RESOLVE', 'not an object'))
    assert.throws(() => continuationModel.create('@@REJECT', 'not an object'))
    assert(resolve)
    assert(reject)
  })
})
