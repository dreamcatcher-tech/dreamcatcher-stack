const assert = require('assert')
const { keypairModel, blockModel, dmzModel } = require('../../w015-models')
const { blockProducer } = require('../../w016-producers')
require('../../w012-crypto').testMode()

describe('blockProducer', () => {
  describe('generateNext', () => {
    test('defaults', async () => {
      const dmz = dmzModel.create()
      const block = await blockModel.create(dmz)
      const next = await blockProducer.generateNext(block.getDmz(), block)
      assert(next.isValidated())
      assert(block.isNext(next))
    })
    test('throws if not block provided', () => {
      assert.rejects(blockProducer.generateNext)
      const dmz = dmzModel.create()
      assert.rejects(() => blockProducer.generateNext(dmz))
      const keypair = keypairModel.create('CI')
      assert.rejects(() =>
        blockProducer.generateNext(dmz, undefined, keypair.sign)
      )
    })
  })
})
