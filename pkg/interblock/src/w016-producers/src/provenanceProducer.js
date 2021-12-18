// produces a prototype of provenance - everything except the actual signature
// can only be used on blocks 1 or higher
// must supply parentProvenance
import assert from 'assert-fast'
import {
  Dmz,
  Provenance,
  Integrity,
  Address,
  Block,
  Signature,
} from '../../w015-models'
import Debug from 'debug'
const debug = Debug('interblock:producers:provenanceProducer')

const generateNextProvenance = (nextDmz, block) => {
  assert(nextDmz instanceof Dmz)
  assert(block instanceof Block)
  assert(!nextDmz.deepEquals(block.getDmz()), 'block dmz has not changed')
  // TODO check the dmz follows from the current one ?
  // TODO put checks in that blocks without new transmissions cannot be created

  const { provenance } = block
  const isTransmitting = nextDmz.isTransmitting()
  const isGenesis = provenance.height === 0
  const lineage = {}
  if (isTransmitting && !isGenesis) {
    // TODO go back to the last validator change
    const hash = provenance.getAddress().getChainId()
    const genesis = Integrity.create(hash)
    const genesisHeight = 0
    lineage[genesisHeight] = genesis
  }
  const dmzIntegrity = Integrity.create(nextDmz)
  debug('dmzIntegrity', dmzIntegrity.hash)
  const parentIntegrity = provenance.reflectIntegrity()
  lineage[provenance.height] = parentIntegrity
  const address = provenance.getAddress()
  const height = provenance.height + 1
  const next = { dmzIntegrity, height, address, lineage }
  const integrity = Provenance.generateIntegrity(next)
  const signatures = []
  const unsigned = provenance.update({ ...next, integrity, signatures })
  return unsigned
}
const addSignature = (provenance, signature) => {
  assert(provenance instanceof Provenance)
  assert(signature instanceof Signature)
  assert(!provenance.signatures.length, `prototype is single sign only`)
  return provenance.update({ signatures: [signature] })
}
const generatePierceProvenance = (pierceDmz, address, parentHeight) => {
  assert(pierceDmz instanceof Dmz)
  assert(address instanceof Address)
  assert(Number.isInteger(parentHeight))
  assert(parentHeight >= 0)

  const dmzIntegrity = Integrity.create(pierceDmz.getHash())
  const height = parentHeight + 1
  const lineage = { 0: address.chainId }
  const nextProvenance = {
    dmzIntegrity,
    height,
    address,
    lineage,
  }
  const integrity = Integrity.create(nextProvenance)
  const signatures = []
  return Provenance.clone({
    ...nextProvenance,
    integrity,
    signatures,
  })
}

export { generateNextProvenance, generatePierceProvenance, addSignature }
