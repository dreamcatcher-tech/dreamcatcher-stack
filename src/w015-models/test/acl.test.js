import assert from 'assert'
import { aclModel } from '..'

describe('acl', () => {
  test('creates default', () => {
    const acl = aclModel.create()
    assert(acl)
    const clone = aclModel.clone()
    assert(clone)
  })
  describe('isAllowed', () => {
    test.todo('rejects based on chainId')
    test.todo('rejects based on alias')
  })
})
