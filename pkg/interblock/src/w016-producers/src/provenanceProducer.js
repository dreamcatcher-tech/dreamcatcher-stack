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
const generatePierceProvenance = (pierceDmz, address, parentHeight) => {
  assert(dmzModel.isModel(pierceDmz))
  assert(addressModel.isModel(address))
  assert(Number.isInteger(parentHeight))
  assert(parentHeight >= 0)

  const dmzIntegrity = integrityModel.create(pierceDmz.getHash())
  const height = parentHeight + 1
  const lineage = { 0: address.chainId }
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
