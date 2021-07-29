import assert from 'assert'
const { publicKeyModel } = require('..')
describe('publicKey', () => {
  test('cannot create', () => {
    assert.throws(publicKeyModel.create)
  })
})
