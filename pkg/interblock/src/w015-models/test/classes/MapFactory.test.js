import { assert } from 'chai/index.mjs'
import { mixin } from '../../src/classes/MapFactory'
import Debug from 'debug'
const debug = Debug('interblock:tests:MapFactory')
Debug.enable('*MapFactory')

describe('MapFactory', () => {
  const schema = {
    type: 'object',
    properties: {
      a: { type: 'string' },
    },
  }
  test('performance', () => {
    // roughly 10x slower than native objects
    const Base = mixin(schema)
    const C = class extends Base {}
    const c = new C().update({ a: 'a' })
    const raw = { a: 'a' }

    const count = 1000000
    let start = Date.now()
    for (let i = 0; i < count; i++) {
      if (raw.a === 'a') {
        if (raw.b === undefined) {
          continue
        }
      }
    }
    debug(`raw: %o ms`, Date.now() - start)
    start = Date.now()
    for (let i = 0; i < count; i++) {
      if (c.a === 'a') {
        continue
      }
    }
    debug(`synthetic: %o ms`, Date.now() - start)
  })
  test('basic', () => {
    const Base = mixin(schema)
    const C = class extends Base {
      fn() {
        return this.a
      }
    }
    const base = new Base()
    assert.strictEqual(base.a, undefined)
    const c = new C()
    assert(!c.a)
    assert.throws(() => (c.a = 'a'))
    const c2 = c.update({ a: 'aVal' })
    const m = c2.a
    assert.strictEqual(c2.a, 'aVal')
  })
  test('collision detection', () => {
    const c = class {
      a() {
        return 'a'
      }
    }
    assert.throws(() => mixin(c, schema))
  })
})
