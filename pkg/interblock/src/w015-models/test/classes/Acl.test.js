import { assert } from 'chai/index.mjs'
import { Acl } from '../../src/classes'

describe('acl', () => {
  test.only('creates default', () => {
    const acl = Acl.create()
    assert(acl)
    const restored = Acl.restore(acl.toArray())
    assert.deepEqual(acl.toArray(), restored.toArray())
  })
  describe('isAllowed', () => {
    test.todo('rejects based on chainId')
    test.todo('rejects based on alias')
  })
})
