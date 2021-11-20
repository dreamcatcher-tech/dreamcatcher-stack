import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { proofSchema } from '../schemas/modelSchemas'
import { blockModel } from './blockModel'

const proofModel = standardize({
  schema: proofSchema,
  create(block, channelName) {
    assert(blockModel.isModel(block))
    const proof = { block: 'REMOVED' }
    if (channelName) {
      assert(block.network[channelName], `missing ${channelName}`)
    } else {
      // TODO assert if no channelName, that we want validators for turnovers
    }
    return proofModel.clone(proof)
  },
  logicize() {
    return {}
  },
})

export { proofModel }
