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
      const block = metrology.getState()
      assert(blockModel.isModel(block))
      assert.strictEqual(block.provenance.height, 0)
      assert.strictEqual(block.network.getAliases().length, 2)
      assert(block.network['..'].address.isRoot())
      await metrology.settle()
    })
    test('two metrology bases have different addresses', async () => {
      const metrology1 = await metrologyFactory('B')
      const metrology2 = await metrologyFactory('C')
      const block1 = metrology1.getState()
      const block2 = metrology2.getState()
      const address1 = block1.provenance.getAddress()
      const address2 = block2.provenance.getAddress()
      assert.notStrictEqual(block1, block2)
      assert.notStrictEqual(address1, address2)
      assert.notStrictEqual(address1.getChainId(), address2.getChainId())
    })
    test.todo('send lineage in all possible combinations and repetitions')
  })

  describe('poolInterblock', () => {
    describe('birthChild', () => {
      test('new child created from genesis', async () => {
        const base = await metrologyFactory('birthChild')
        base.enableLogging()
        await base.spawn('child')
        await base.settle()
        const baseState = base.getState()
        assert(blockModel.isModel(baseState))
        assert.strictEqual(baseState.provenance.height, 2)
        const childChannel = baseState.network.child
        assert.strictEqual(childChannel.tipHeight, 1)
        assert(!childChannel.isTransmitting())
        const block1Integrity = base.getState(1).provenance.reflectIntegrity()
        assert.strictEqual(childChannel.precedent, block1Integrity)

        const { child } = base.getChildren()
        const childState = child.getState()
        assert.strictEqual(childState.provenance.height, 1)
        assert.strictEqual(Object.keys(child.getChannels()).length, 2)
        assert.strictEqual(Object.keys(base.getChannels()).length, 4)
        assert.strictEqual(baseState.network.child.systemRole, './')
        assert(childChannel.address.equals(childState.provenance.getAddress()))
        const parent = childState.network['..']
        assert(parent.address.equals(baseState.provenance.getAddress()))
        assert.strictEqual(parent.tipHeight + 1, baseState.provenance.height)
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
