import { assert } from 'chai/index.mjs'
import { Acl } from '../../src/classes'

describe('acl', () => {
  test('creates default', () => {
    const acl = Acl.create()
    assert(acl)
    const restored = Acl.restore(acl.toArray())
    assert.deepEqual(acl.toArray(), restored.toArray())
  })
  test('cannot alter schema', () => {
    assert.throws(() => delete Acl.schema)
    assert.throws(() => (Acl.schema = {}))
    assert.throws(() => (Acl.schema.add = {}))
    assert.throws(() => delete Acl.schema.title)
  })
  describe('isAllowed', () => {
    test.todo('rejects based on chainId')
    test.todo('rejects based on alias')
  })
})
