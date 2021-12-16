import assert from 'assert-fast'
import { Block, Dmz } from '../../w015-models'
import {
  generateNextProvenance,
  addSignature,
  generatePierceProvenance,
} from './provenanceProducer'

const assemble = (unsignedBlock, signature) => {
  const provenance = addSignature(unsignedBlock.provenance, signature)
  return Block.clone({ ...unsignedBlock, provenance })
}
const generateUnsigned = (nextDmz, block) => {
  assert(nextDmz instanceof Dmz)
  assert(block instanceof Block)
  const provenance = generateNextProvenance(nextDmz, block)
  return Block.clone({ ...nextDmz, provenance })
}
const generatePierceBlock = (pierceDmz, targetBlock) => {
  const ioChannel = targetBlock.network['.@@io']
  if (ioChannel) {
    const { tipHeight, address } = ioChannel
    const provenance = generatePierceProvenance(pierceDmz, address, tipHeight)
    return Block.clone({ ...pierceDmz, provenance })
  }
  return Block.create(pierceDmz)
}
export { assemble, generateUnsigned, generatePierceBlock }
