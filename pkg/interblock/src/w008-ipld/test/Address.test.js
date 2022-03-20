import { assert } from 'chai/index.mjs'
import { Address } from '..'
import { cidV0FromString } from '../src/Address'
describe('address', () => {
  test('no params makes unknown address', () => {
    const address = Address.createUnknown()
    assert(!address.isGenesis())
    assert(address.isUnknown())
    assert.throws(() => address.getChainId(), 'Address not resolved')
    const genesis = Address.createGenesis()
    assert(genesis.isGenesis())
    assert(!genesis.isUnknown())
    assert.throws(() => genesis.getChainId(), 'Address not resolved')
  })
  test('rejects random objects', () => {
    assert.throws(() => Address.create({ some: 'random thing' }), 'cid')
  })
  test('test addresses from strings', () => {
    const cid = cidV0FromString('testing')
    const address = Address.create(cid)
    assert(!address.isUnknown())
    assert(!address.isGenesis())
    assert.strictEqual(address.getChainId(), cid.toString())
  })
  test.todo('generate from provenance')
})
