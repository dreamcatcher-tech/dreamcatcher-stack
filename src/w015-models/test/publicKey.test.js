import { assert } from 'chai/index.mjs'
import { publicKeyModel } from '..'
describe('publicKey', () => {
  test('cannot create', () => {
    assert.throws(publicKeyModel.create)
  })
})
