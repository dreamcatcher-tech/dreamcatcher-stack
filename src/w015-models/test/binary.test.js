import { assert } from 'chai/index.mjs'
import { binaryModel } from '..'

describe('binary', () => {
  test('creates default', () => {
    const bin = binaryModel.create()
    assert(bin && bin.integrity.isUnknown() && bin.size === 0)
  })
})
