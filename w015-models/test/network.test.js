const assert = require('assert')
const { networkModel } = require('..')

describe('network', () => {
  test('creates default', () => {
    const network = networkModel.create()
    assert(network['..'])
    assert(network['.'])
    assert.equal(network.getAliases().length, 2)
  })
  test('parent is unknown by default', () => {
    const network = networkModel.create()
    const parent = network['..']
    assert(parent)
    assert(parent.address.isUnknown())
  })
  test.todo('rxReply always selected before rxRequest')
  test.todo('rxReply( request ) throws if non existant channel in request')
  test.todo('empty string cannot be used as channel name')
})
