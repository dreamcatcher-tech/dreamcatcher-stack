import assert from 'assert'
import { lockModel } from '..'

describe('lock', () => {
  test('creates', () => {
    const lock = lockModel.create()
    assert(lock && lock.isLocked() && !lock.block)
    const clone = lockModel.clone(lock)
    assert(clone.equals(lock))
    const fromJson = lockModel.clone(clone.serialize())
    assert(fromJson.equals(clone) && fromJson.isLocked())
  })
  test('lock expiration', () => {
    const lock = lockModel.create()
    const expired = lockModel.clone({ ...lock, expires: 0 })
    assert(!expired.isLocked())
  })
  test.todo('no duplicate piercings allowed in creation')
  test.todo('no duplicate piercings allowed in clone')
  test.todo('no duplication interblocks allowed in creation')
  test.todo('no duplication interblocks allowed in clone')
  test.todo('interblocks in order in create')
  test.todo('interblocks in order in clone')
  test.todo('piercings included in block are removed in create')
  test.todo('piercings included in block error in clone')
})
