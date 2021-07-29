import assert from 'assert'
const { standardize } = require('../modelUtils')
const { proofSchema } = require('../schemas/modelSchemas')
const { blockModel } = require('./blockModel')

const proofModel = standardize({
  schema: proofSchema,
  create(block, channelName) {
    assert(blockModel.isModel(block))
    const proof = { block: block.getProof() }
    if (channelName) {
      assert(block.network[channelName], `missing ${channelName}`)
      proof.network = block.network.getProof()
      proof.channel = block.network[channelName].getProof()
    }
    return proofModel.clone(proof)
  },
  logicize(instance) {
    return {}
  },
})

module.exports = { proofModel }
