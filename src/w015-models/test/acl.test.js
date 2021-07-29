import assert from 'assert'
const { aclModel } = require('..')

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
