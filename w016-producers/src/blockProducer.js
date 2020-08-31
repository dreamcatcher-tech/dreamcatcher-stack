const assert = require('assert')
const {
  dmzModel,
  keypairModel,
  provenanceModel,
  blockModel,
  integrityModel,
} = require('../../w015-models')

const ciSigner = async (integrity) => {
  const ciKeypair = keypairModel.create('CI')
  assert(integrityModel.isModel(integrity))
  return ciKeypair.sign(integrity)
}

const generateNext = async (dmz, currentBlock, asyncSigner = ciSigner) => {
  // TODO check the dmz follows from the current one ?
  assert(dmzModel.isModel(dmz))
  assert(typeof asyncSigner === 'function')
  assert(blockModel.isModel(currentBlock))

  const isForked = dmz.network.isNewChannels(currentBlock.network)
  const lineage = []
  const isGenesis = currentBlock.provenance.height === 0
  if (isForked && !isGenesis) {
    const template = integrityModel.create()
    const hash = currentBlock.provenance.getAddress().getChainId()
    const genesis = integrityModel.clone({ ...template, hash })
    lineage.push(genesis)
  }

  const provenance = await provenanceModel.create(
    dmz,
    currentBlock.provenance,
    lineage,
    asyncSigner
  )
  const nextBlock = blockModel.clone({ ...dmz, provenance })
  assert(currentBlock.isNext(nextBlock))
  return nextBlock
}

module.exports = { generateNext }
