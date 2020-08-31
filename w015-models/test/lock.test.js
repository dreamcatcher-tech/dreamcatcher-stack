const assert = require('assert')
const { lockModel } = require('..')
require('../../w012-crypto').testMode()

describe('lock', () => {
  test('creates', () => {
    const lock = lockModel.create()
    assert(lock && lock.isLocked() && !lock.block)
    const clone = lockModel.clone(lock)
    assert(clone === lock)
    const json = lockModel.clone(clone.serialize())
    assert(json === clone && json.isLocked())
  })
  test('lock expiration', () => {
    const lock = lockModel.create()
    const expired = lockModel.clone({ ...lock, expires: 0 })
    assert(!expired.isLocked())
  })
})
