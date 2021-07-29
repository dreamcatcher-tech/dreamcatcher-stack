import assert from 'assert'
const { timestampModel } = require('..')
describe('timestamp', () => {
  test('create', () => {
    const now = timestampModel.create()
    assert(now)
    const clone = timestampModel.clone()
    assert(clone)

    const isExpired = now.isExpired(1000)
    assert(!isExpired)
    assert(now.isExpired(-1000))
  })
})
