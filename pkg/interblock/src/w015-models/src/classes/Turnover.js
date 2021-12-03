import assert from 'assert-fast'
import { Block, Proof } from '.'
import { turnoverSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Turnover extends mixin(turnoverSchema) {
  static create(block) {
    assert(block instanceof Block)
    assert(block.isVerifiedBlock(), `Block must be verified`)
    const proof = Proof.create(block)
    const { validators, provenance } = block

    return super.create({ provenance, proof, validators })
  }
  assertLogic() {
    const { provenance, proof, validators } = this
    // TODO assert that a turnover occured in this block
    // TODO assert(integrity.checkEntryProof('validators', validators))
    // TODO test method for walking turnover path
  }
}
