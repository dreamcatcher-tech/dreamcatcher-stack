const assert = require('assert')
const { binaryModel } = require('..')

describe('binary', () => {
  test('creates default', () => {
    const bin = binaryModel.create()
    assert(bin && bin.integrity.isUnknown() && bin.size === 0)
  })
})
