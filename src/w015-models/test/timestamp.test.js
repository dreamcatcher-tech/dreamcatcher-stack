import assert from 'assert'
import { timestampModel } from '..'
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
