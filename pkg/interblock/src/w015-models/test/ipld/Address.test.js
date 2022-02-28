import { assert } from 'chai/index.mjs'
import { Address } from '../../src/ipld'

describe('address', () => {
  test('no params makes unknown address', () => {
    const address = Address.create()
    assert(!address.isGenesis())
    assert(address.isUnknown())
    assert.throws(() => address.getChainId(), 'Address not resolved')
    const genesis = Address.create('GENESIS')
    assert(genesis.isGenesis())
    assert(!genesis.isUnknown())
    assert.throws(() => genesis.getChainId(), 'Address not resolved')
  })
  test('rejects random objects', () => {
    assert.throws(() => Address.create({ some: 'random thing' }), 'Wrong type')
  })
  test('test addresses from strings', () => {
    const { hash } = Integrity.create('test address')
    assert.strictEqual(typeof hash, 'string')
    assert.strictEqual(hash.length, 64)
    const address = Address.create(hash)
    assert(!address.isUnknown())
    assert(!address.isGenesis())
  })
  test('from integrity', () => {
    const integrity = Integrity.create({ some: 'object' })
    const address = Address.create(integrity)
    assert(!address.isGenesis())
    assert(!address.isUnknown())
    assert.strictEqual(address.getChainId(), integrity.hash)
  })
  test('genesis is randomized', () => {
    const a1 = Address.create('GENESIS')
    const a2 = Address.create('GENESIS')
    assert(!a1.deepEquals(a2))
    const u1 = Address.create()
    const u2 = Address.create()
    assert(u1.deepEquals(u2))
    assert(!a1.deepEquals(u1))
    assert(!a2.deepEquals(u1))
  })
})
