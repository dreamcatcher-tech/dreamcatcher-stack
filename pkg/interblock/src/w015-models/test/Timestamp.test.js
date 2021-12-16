import { assert } from 'chai/index.mjs'
import { Timestamp } from '..'
describe('timestamp', () => {
  test('create', () => {
    const now = Timestamp.create()
    assert(now)
    const clone = Timestamp.restore(now.toArray())
    assert(clone)

    const isExpired = now.isExpired(1000)
    assert(!isExpired)
    assert(now.isExpired(-1000))
  })
})
