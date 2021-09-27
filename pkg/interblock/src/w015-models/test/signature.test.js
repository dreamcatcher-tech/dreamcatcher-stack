import { assert } from 'chai/index.mjs'
import { signatureModel } from '..'

describe('signature', () => {
  test('throws on create attempts', () => {
    assert.throws(signatureModel.create)
  })
})
