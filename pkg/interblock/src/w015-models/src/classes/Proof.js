import assert from 'assert-fast'
import { Block } from '.'
import { proofSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Proof extends mixin(proofSchema) {
  static create(block, channelName) {
    assert(block instanceof Block)
    const proof = { block: 'TODO' }
    if (channelName) {
      assert(block.network.has(channelName), `missing ${channelName}`)
    } else {
      // TODO assert if no channelName, that we want validators for turnovers
    }
    return super.create(proof)
  }
}
