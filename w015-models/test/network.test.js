const assert = require('assert')
const { networkModel } = require('..')

describe('network', () => {
  test('creates default', () => {
    const network = networkModel.create()
    assert(network['..'])
    assert(network['.'])
    assert.strictEqual(network.getAliases().length, 2)
  })
  test('parent is unknown by default', () => {
    const network = networkModel.create()
    const parent = network['..']
    assert(parent)
    assert(parent.address.isUnknown())
  })
  test('aliases are frozen', () => {
    const network = networkModel.create()
    const aliases = network.getAliases()
    assert.strictEqual(aliases.length, 2)
    assert.throws(() => aliases.push('test'))
  })
  test.todo('rxReply always selected before rxRequest')
  test.todo('rxReply( request ) throws if non existant channel in request')
  test.todo('empty string cannot be used as channel name')
})
