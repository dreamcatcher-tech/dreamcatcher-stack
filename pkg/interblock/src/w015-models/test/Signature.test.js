import { assert } from 'chai/index.mjs'
import { Signature } from '..'

describe('signature', () => {
  test('throws on create attempts', () => {
    assert.throws(() => Signature.create())
  })
})
