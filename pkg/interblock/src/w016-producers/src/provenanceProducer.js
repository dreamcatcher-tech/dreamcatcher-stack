// produces a prototype of provenance - everything except the actual signature
// can only be used on blocks 1 or higher
// must supply parentProvenance
import assert from 'assert-fast'
import {
  dmzModel,
  provenanceModel,
  integrityModel,
  addressModel,
  blockModel,
  signatureModel,
} from '../../w015-models'

const generateNextProvenance = (nextDmz, block) => {
  assert(dmzModel.isModel(nextDmz))
  assert(blockModel.isModel(block))
  assert(!nextDmz.equals(block.getDmz()), 'block dmz has not changed')
  // TODO check the dmz follows from the current one ?
  // TODO handle no change to dmz but change in lineage
  // TODO put checks in that blocks without new transmissions cannot be created
  // basically all lineage rules should be checked here

  const { provenance } = block
  const isNewChannels = nextDmz.network.isNewChannels(block.network)
  const lineage = {}
  const isGenesis = provenance.height === 0
  if (isNewChannels && !isGenesis) {
    // TODO go back to the last validator change
    const hash = provenance.getAddress().getChainId()
    const genesis = integrityModel.create(hash)
    lineage[0] = genesis
  }
  const dmzIntegrity = integrityModel.create(nextDmz.getHash())
  const parentIntegrity = provenance.reflectIntegrity()
  lineage[provenance.height] = parentIntegrity
  const address = provenance.getAddress()
  const height = provenance.height + 1
  const nextProvenance = {
    dmzIntegrity,
    height,
    address,
    lineage,
  }
  const integrity = integrityModel.create(nextProvenance)
  const signatures = []
  const unsigned = provenanceModel.clone({
    ...nextProvenance,
    integrity,
    signatures,
  })
  return unsigned
}
const addSignature = (provenance, signature) => {
  assert(provenanceModel.isModel(provenance))
  assert(signatureModel.isModel(signature))
  assert(!provenance.signatures.length, `temporarily single sign only`)
  return provenanceModel.clone({ ...provenance, signatures: [signature] })
}
const generatePierceProvenance = (pierceDmz, parentProvenance) => {
  assert(dmzModel.isModel(pierceDmz))
  assert(provenanceModel.isModel(parentProvenance))

  // TODO assert validator is only the PIERCE key, and public key matches
  // signs with a predetermined key, since no point invoking crypto on pierce

  const dmzIntegrity = integrityModel.create(pierceDmz.getHash())
  const parentIntegrity = parentProvenance.reflectIntegrity()
  const lineage = { [parentProvenance.height]: parentIntegrity }
  const address = parentProvenance.getAddress()
  const height = parentProvenance.height + 1
  const nextProvenance = {
    dmzIntegrity,
    height,
    address,
    lineage,
  }
  const integrity = integrityModel.create(nextProvenance)
  const signatures = []
  return provenanceModel.clone({
    ...nextProvenance,
    integrity,
    signatures,
  })
}

export { generateNextProvenance, generatePierceProvenance, addSignature }
