import assert from 'assert-fast'
import { standardize } from '../../modelUtils'
import { proofModel } from '../proofModel'
import { blockModel } from './blockModel'
import { turnoverSchema } from '../../schemas/modelSchemas'
import Debug from 'debug'
const debug = Debug('interblock:models:turnover')

const turnoverModel = standardize({
  schema: turnoverSchema,
  create(block) {
    assert(blockModel.isModel(block))
    assert(block.isVerifiedBlock(), `Block must be verified`)
    const proof = proofModel.create(block)
    const { validators, provenance } = block

    return turnoverModel.clone({ provenance, proof, validators })
  },

  logicize(instance) {
    const { provenance, proof, validators } = instance
    // TODO assert that a turnover occured in this block
    // TODO assert(integrity.checkEntryProof('validators', validators))
    // TODO test method for walking turnover path
    return {}
  },
})

export { turnoverModel }
