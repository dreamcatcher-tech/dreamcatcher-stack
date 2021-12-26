import madge from 'madge'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { assert } from 'chai/index.mjs'
import * as Models from '..' // needed so mixin can be imported
import { mixin } from '../src/MapFactory'
import Debug from 'debug'
import { Integrity } from '..'
const debug = Debug('interblock:tests:MapFactory')
Debug.enable()

describe('MapFactory', () => {
  const schema = {
    type: 'object',
    properties: {
      a: { type: 'string' },
    },
  }
  test('performance', () => {
    // roughly 10x to 50x slower than native objects
    const Base = mixin(schema)
    const C = class extends Base {}
    const c = C.create().update({ a: 'a' })
    const raw = { a: 'a' }

    const count = 10000
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
    const base = Base.create()
    assert.strictEqual(base.a, undefined)
    const c = C.create()
    assert(!c.a)
    assert.throws(() => (c.a = 'a'))
    const c2 = c.update({ a: 'aVal' })
    const m = c2.a
    assert.strictEqual(c2.a, 'aVal')
  })
  test('objects are immutable', () => {
    const integrity = Integrity.create({ test: 'test' })
    assert(integrity.hash)
    delete integrity.hash
    assert(integrity.hash)
  })
  test('functions are immutable', () => {
    const integrity = Integrity.create({ test: 'test' })
    assert.strictEqual(typeof integrity.isUnknown, 'function')
    delete integrity.isUnknown
    assert.strictEqual(typeof integrity.isUnknown, 'function')
  })
  test('cannot alter schema', () => {
    assert(Integrity.schema)
    delete Integrity.schema
    assert(Integrity.schema)
    assert.throws(() => (Integrity.schema = {}))
    assert.throws(() => (Integrity.schema.add = {}))
    assert.throws(() => delete Integrity.schema.title)
  })
  test.skip('no circular references in models', async () => {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const res = await madge(__dirname + '/../src/classes', {
      excludeRegExp: [/\.\./],
    })
    const path = await res.image(
      __dirname + '/../../../website/static/img/models.svg'
    )
    console.log(`wrote image to: ${path}`)
  })
  test.todo('reject on schema fail')
  test.todo('check the version of the message format')
  test.todo('can always create default with no arguments')
  test.todo('clone handles dmz.state with loops')
  test.todo('optional properties which are missing are not inflated')
})
