import assert from 'assert-fast'
import { Block, Dmz, Signature } from '../../w015-models'
import {
  generateNextProvenance,
  addSignature,
  generatePierceProvenance,
} from './provenanceProducer'
import Debug from 'debug'
const debug = Debug('interblock:producers:blockProducer')
const assemble = (unsignedBlock, signature) => {
  assert(unsignedBlock instanceof Block)
  assert(signature instanceof Signature)
  const provenance = addSignature(unsignedBlock.provenance, signature)
  return unsignedBlock.update({ provenance })
}
const generateUnsigned = (nextDmz, block) => {
  assert(nextDmz instanceof Dmz)
  assert(block instanceof Block)
  const provenance = generateNextProvenance(nextDmz, block)
  debug(provenance.dmzIntegrity.hash)
  const nextBlock = block.update({ ...nextDmz.spread(), provenance })
  nextBlock.assertLogic()
  return nextBlock
}
const generatePierceBlock = (pierceDmz, targetBlock) => {
  const ioChannel = targetBlock.network.get('.@@io')
  pierceDmz = pierceDmz.merge()
  if (ioChannel) {
    const { tipHeight, address } = ioChannel
    const provenance = generatePierceProvenance(pierceDmz, address, tipHeight)
    return Block.clone({ ...pierceDmz.spread(), provenance })
  }
  return Block.create(pierceDmz)
}
export { assemble, generateUnsigned, generatePierceBlock }
