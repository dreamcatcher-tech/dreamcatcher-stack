const assert = require('assert')
const { keypairModel, blockModel, dmzModel } = require('../../w015-models')
const { blockProducer } = require('../../w016-producers')
require('../../w012-crypto').testMode()

describe('blockProducer', () => {
  describe('generateNext', () => {
    test('defaults', async () => {
      const block = await blockModel.create()
      const dmz = dmzModel.create({ state: { test: 'changedState' } })

      const next = await blockProducer.generateNext(dmz, block)
      assert(next.isValidated())
      assert(block.isNext(next))
    })
    test('throws if not block provided', async () => {
      assert.rejects(blockProducer.generateNext)
      const dmz = dmzModel.create()
      await assert.rejects(() => blockProducer.generateNext(dmz))
      const keypair = keypairModel.create('CI')
      await assert.rejects(() =>
        blockProducer.generateNext(dmz, undefined, keypair.sign)
      )
    })
    test('no duplicates created', async () => {
      const block = await blockModel.create()
      const dmz = block.getDmz()
      await assert.rejects(() => blockProducer.generateNext(dmz, block))
    })
    test('pass serialize test', async () => {
      const block = await blockModel.create()
      const state = { test: 'state' }
      const nextDmz = dmzModel.clone({ ...block.getDmz(), state })
      const nextBlock = await blockProducer.generateNext(nextDmz, block)
      const json = nextBlock.serialize()
      const clone = blockModel.clone(json)
      assert(clone)
    })
  })
})
