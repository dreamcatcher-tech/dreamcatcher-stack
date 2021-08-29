import { assert } from 'chai/index.mjs'
import { standardize } from '../modelUtils'
import { proofSchema } from '../schemas/modelSchemas'
import { blockModel } from './blockModel'

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

export { proofModel }
