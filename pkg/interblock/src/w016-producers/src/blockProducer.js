import { assert } from 'chai/index.mjs'
import { dmzModel, blockModel } from '../../w015-models'
import {
  generateNextProvenance,
  generateGenesisProvenance,
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
const generateGenesisBlock = (dmz, forkedLineages = {}) => {
  dmz = dmz || dmzModel.create()
  assert(dmzModel.isModel(dmz))
  const provenance = generateGenesisProvenance(dmz, forkedLineages)
  const block = blockModel.clone({ ...dmz, provenance })
  return block
}
const generatePierceBlock = (pierceDmz, block) => {
  const ioChannel = block.network['.@@io']
  if (ioChannel) {
    assert(ioChannel.heavy.provenance)
    const parentProvenance = ioChannel.heavy.provenance
    const provenance = generatePierceProvenance(pierceDmz, parentProvenance)
    return blockModel.clone({ ...pierceDmz, provenance })
  }
  return generateGenesisBlock(pierceDmz)
}
export { generateGenesisBlock, assemble, generateUnsigned, generatePierceBlock }
