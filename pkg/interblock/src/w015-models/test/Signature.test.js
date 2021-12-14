import { assert } from 'chai/index.mjs'
import { Signature } from '../../src/classes'

describe('signature', () => {
  test('throws on create attempts', () => {
    assert.throws(() => Signature.create())
  })
})
