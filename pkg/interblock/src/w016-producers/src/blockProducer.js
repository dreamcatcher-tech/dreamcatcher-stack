import assert from 'assert-fast'
import { Block, Dmz } from '../../w015-models'
import {
  generateNextProvenance,
  addSignature,
  generatePierceProvenance,
} from './provenanceProducer'
import Debug from 'debug'
const debug = Debug('interblock:producers:blockProducer')
const assemble = (unsignedBlock, signature) => {
  const provenance = addSignature(unsignedBlock.provenance, signature)
  return Block.clone({ ...unsignedBlock.spread(), provenance })
}
const generateUnsigned = (nextDmz, block) => {
  assert(nextDmz instanceof Dmz)
  assert(block instanceof Block)
  nextDmz = nextDmz.merge() // TODO WARNING when should merge occur ?
  const provenance = generateNextProvenance(nextDmz, block)
  debug(nextDmz.hashString())
  debug(provenance.dmzIntegrity.hash)
  return Block.clone({ ...nextDmz.spread(), provenance })
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
