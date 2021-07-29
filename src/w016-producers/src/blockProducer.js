import assert from 'assert'
import {
  dmzModel,
  provenanceModel,
  blockModel,
  integrityModel,
  ciSigner,
} from '../../w015-models'

const generateNext = async (dmz, block, asyncSigner = ciSigner) => {
  // TODO check the dmz follows from the current one ?
  // TODO handle no change to dmz but change in lineage
  // TODO put checks in that blocks without new transmissions cannot be created
  // basically all lineage rules should be checked here
  assert(dmzModel.isModel(dmz))
  assert(blockModel.isModel(block))
  assert(!dmz.equals(block.getDmz()), 'block dmz has not changed')
  assert(typeof asyncSigner === 'function') // TODO move into blockModel

  const isNewChannels = dmz.network.isNewChannels(block.network)
  const extraLineage = {}
  const isGenesis = block.provenance.height === 0
  if (isNewChannels && !isGenesis) {
    // TODO go back to the last validator change
    const template = integrityModel.create()
    const hash = block.provenance.getAddress().getChainId()
    const genesis = integrityModel.clone({ ...template, hash })
    extraLineage[0] = genesis
  }

  const provenance = await provenanceModel.create(
    dmz,
    block.provenance,
    extraLineage,
    asyncSigner
  )
  const nextBlock = blockModel.clone({ ...dmz, provenance })

  assert(block.isNext(nextBlock))
  return nextBlock
}

export { generateNext }
