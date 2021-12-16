import { assert } from 'chai/index.mjs'
import { Binary } from '..'

describe('binary', () => {
  test('creates default', () => {
    const bin = Binary.create()
    assert(bin && bin.integrity.isUnknown() && bin.size === 0)
  })
})
