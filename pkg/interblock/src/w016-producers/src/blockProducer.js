import assert from 'assert-fast'
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
const generatePierceBlock = (pierceDmz, targetBlock) => {
  const ioChannel = targetBlock.network['.@@io']
  if (ioChannel) {
    const { tipHeight, address } = ioChannel
    const provenance = generatePierceProvenance(pierceDmz, address, tipHeight)
    return blockModel.clone({ ...pierceDmz, provenance })
  }
  return blockModel.create(pierceDmz)
}
export { assemble, generateUnsigned, generatePierceBlock }
