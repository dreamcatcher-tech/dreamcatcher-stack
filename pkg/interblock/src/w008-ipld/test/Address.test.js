import { assert } from 'chai/index.mjs'
import { Address, Pulse } from '..'
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
  test('generate from Pulse', async () => {
    const pulse = await Pulse.create().crush()
    const address = Address.generate(pulse)
    assert.strictEqual(address.cid.version, 0)
    assert(address.ipldBlock)
    assert.strictEqual(address.cid, address.ipldBlock.cid)
    assert(!address.isModified())

    const diffs = address.getDiffBlocks()
    assert.strictEqual(diffs.size, 1)

    const crushed = address.crush()
    const nextDiffs = crushed.getDiffBlocks()
    assert.strictEqual(nextDiffs.size, 0)
  })
})
