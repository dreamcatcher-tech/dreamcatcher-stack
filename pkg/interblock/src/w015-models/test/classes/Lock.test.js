import { assert } from 'chai/index.mjs'
import { Lock } from '../../src/classes'
import Debug from 'debug'
const debug = Debug('interblock:tests:Lock')

describe.only('lock', () => {
  test('creates', () => {
    const lock = Lock.create()
    assert(lock && lock.isLocked() && !lock.block)
    const restored = Lock.restore(lock.toArray())
    debug(restored.toJS())
    debug(lock.toJS())
    assert(restored.deepEquals(lock))
    assert(restored.isLocked())
  })
  test('lock expiration', () => {
    const lock = Lock.create()
    assert.strictEqual(lock.expires, 2000)
    const array = lock.toArray()
    array[1] = 0
    const expired = Lock.restore(array)
    assert.strictEqual(expired.expires, 0)
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
