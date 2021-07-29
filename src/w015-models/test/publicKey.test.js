import assert from 'assert'
import { publicKeyModel } from '..'
describe('publicKey', () => {
  test('cannot create', () => {
    assert.throws(publicKeyModel.create)
  })
})
