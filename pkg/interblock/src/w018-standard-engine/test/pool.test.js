import { assert } from 'chai/index.mjs'
import { metrologyFactory } from '../src/metrologyFactory'
import { blockModel } from '../../w015-models'
import { jest } from '@jest/globals'
import Debug from 'debug'
const debug = Debug('interblock:tests:pool')
Debug.enable()

describe('pool', () => {
  describe('initializeStorage', () => {
    test('initial conditions creates new baseChain', async () => {
      const metrology = await metrologyFactory('A')
      const block = await metrology.getLatest()
      assert(blockModel.isModel(block))
      assert.strictEqual(block.provenance.height, 0)
      assert.strictEqual(block.network.getAliases().length, 2)
      assert(block.network['..'].address.isRoot())
      await metrology.settle()
    })
    test('two metrology bases have different addresses', async () => {
      const metrology1 = await metrologyFactory('B')
      const metrology2 = await metrologyFactory('C')
      const block1 = await metrology1.getLatest()
      const block2 = await metrology2.getLatest()
      const address1 = block1.provenance.getAddress()
      const address2 = block2.provenance.getAddress()
      assert.notStrictEqual(block1, block2)
      assert.notStrictEqual(address1, address2)
      assert.notStrictEqual(address1.getChainId(), address2.getChainId())
    })
  })

  describe('poolInterblock', () => {
    describe('birthChild', () => {
      test('new child created from genesis', async () => {
        const base = await metrologyFactory('birthChild')
        base.enableLogging()
        await base.spawn('child')
        await base.settle()
        const baseBlock = await base.getLatest()
        assert(blockModel.isModel(baseBlock))
        assert.strictEqual(baseBlock.provenance.height, 2)
        const childChannel = baseBlock.network.child
        assert.strictEqual(childChannel.tipHeight, 1)
        assert(!childChannel.isTransmitting())
        const block1 = await base.getBlock(1)
        const block1Integrity = block1.provenance.reflectIntegrity()
        assert(block1Integrity.equals(childChannel.precedent))

        const childBlock = await base.getLatestFromPath('/child')
        assert.strictEqual(childBlock.provenance.height, 1)
        assert.strictEqual(childBlock.network.getAliases().length, 2)
        assert.strictEqual(baseBlock.network.getAliases().length, 4)
        assert.strictEqual(baseBlock.network.child.systemRole, './')
        assert(childChannel.address.equals(childBlock.provenance.getAddress()))
        const parent = childBlock.network['..']
        assert(parent.address.equals(baseBlock.provenance.getAddress()))
        assert.strictEqual(parent.tipHeight + 1, baseBlock.provenance.height)
        const { tip } = parent
        assert(tip.equals(block1Integrity))
      })
    })
    describe('poolAffectedChains', () => {
      test.todo('already included interblocks are dropped')
      test.todo('connection attempt makes it thru')
      test.todo('connection denied for chain that is not listening')
      test.todo('connection ignored by receiver if chain already connected')
      test.todo('connection not attempted by sender if chain already connected')
    })
  })
})
