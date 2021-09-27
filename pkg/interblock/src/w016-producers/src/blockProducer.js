import { assert } from 'chai/index.mjs'
import { dmzModel, blockModel } from '../../w015-models'
import {
  generateNextProvenance,
  addSignature,
  generatePierceProvenance,
} from './provenanceProducer'

const assemble = (unsignedBlock, signature) => {
  const provenance = addSignature(unsignedBlock.provenance, signature)
  return blockModel.clone({ ...unsignedBlock, provenance })
}
const generateUnsigned = (nextDmz, block) => {
  assert(dmzModel.isModel(nextDmz))
  assert(blockModel.isModel(block))
  const provenance = generateNextProvenance(nextDmz, block)
  return blockModel.clone({ ...nextDmz, provenance })
}
const generatePierceBlock = (pierceDmz, block) => {
  const ioChannel = block.network['.@@io']
  if (ioChannel) {
    assert(ioChannel.heavy.provenance)
    const parentProvenance = ioChannel.heavy.provenance
    const provenance = generatePierceProvenance(pierceDmz, parentProvenance)
    return blockModel.clone({ ...pierceDmz, provenance })
  }
  return blockModel.create(pierceDmz)
}
export { assemble, generateUnsigned, generatePierceBlock }
