const assert = require('assert')
const debug = require('debug')('interblock:tests:pool')
const { metrologyFactory } = require('../src/metrologyFactory')
const { blockModel } = require('../../w015-models')
require('../../w012-crypto').testMode()

describe('pool', () => {
  require('debug').enable('*metro* *crypto *lock')
  describe('initializeStorage', () => {
    test('initial conditions creates new baseChain', async () => {
      const metrology = await metrologyFactory('A')
      const block = metrology.getState()
      assert(blockModel.isModel(block))
      assert.equal(block.provenance.height, 0)
      assert.equal(block.network.getAliases().length, 2)
      assert(block.network['..'].address.isRoot())

      const { sqsIncrease } = metrology.getEngine()
      const address = await sqsIncrease.awaitNextPush()
      assert(address.equals(block.provenance.getAddress()))
      await metrology.settle()
    })
    test('two metrology bases have different addresses', async () => {
      const metrology1 = await metrologyFactory('B')
      const metrology2 = await metrologyFactory('C')
      const block1 = metrology1.getState()
      const block2 = metrology2.getState()
      const address1 = block1.provenance.getAddress()
      const address2 = block2.provenance.getAddress()
      assert.notEqual(block1, block2)
      assert.notEqual(address1, address2)
      assert.notEqual(address1.getChainId(), address2.getChainId())
    })
    test.todo('send lineage in all possible combinations and repetitions')
  })

  describe('poolInterblock', () => {
    describe('birthChild', () => {
      test('new child created from genesis', async () => {
        require('debug').enable('*metro*')
        const base = await metrologyFactory('birthChild').spawn('child')
        const baseState = base.getState()
        assert(blockModel.isModel(baseState))
        assert.equal(baseState.provenance.height, 1)
        const childChannel = baseState.network.child
        assert(childChannel.heavy)
        assert.equal(childChannel.lineageTip.length, 1)
        assert(!childChannel.lineageTip[0].getRemote())
        assert.equal(childChannel.lineageHeight, 0)
        assert.equal(childChannel.heavyHeight, 0)
        const remote = childChannel.getRemote()
        assert.equal(remote.lineageHeight, -1)
        assert.equal(remote.heavyHeight, -1)

        const child = await base.getChildren().child
        const childState = child.getState()
        assert.equal(childState.provenance.height, 2)
        assert.equal(Object.keys(child.getChannels()).length, 2)
        assert.equal(Object.keys(base.getChannels()).length, 3)
        assert.equal(baseState.network.child.systemRole, './')
        assert(childChannel.address.equals(childState.provenance.getAddress()))
        const parentChannel = childState.network['..']
        assert(parentChannel.address.equals(baseState.provenance.getAddress()))
        assert.equal(parentChannel.lineageHeight, baseState.provenance.height)
        assert.equal(parentChannel.heavyHeight, baseState.provenance.height)
        const { lineage } = parentChannel
        const isLineageMatch = lineage.every((parent, index) =>
          parent.equals(base.getState(index).provenance.reflectIntegrity())
        )
        assert(isLineageMatch)
        await base.settle()
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
