import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { continuationModel } from './continuationModel'
import { blockModel } from './blockModel'
import { remoteModel } from './remoteModel'
import { interblockSchema } from '../schemas/modelSchemas'
import { proofModel } from './proofModel'
import Debug from 'debug'
import { turnoverModel } from './converted/turnoverModel'
const debug = Debug('interblock:models:interblock')

const interblockModel = standardize({
  schema: interblockSchema,
  create(block, networkAlias, turnovers = []) {
    // TODO allow multiple aliases
    assert(blockModel.isModel(block))
    assert(block.isVerifiedBlock(), `Block must be verified`)
    assert.strictEqual(typeof networkAlias, 'string')
    assert(networkAlias !== '.', `Cannot make interblock from loopback channel`)
    assert(Array.isArray(turnovers))
    assert(turnovers.every(turnoverModel.isModel))

    const { provenance } = block
    const proof = proofModel.create(block, networkAlias)
    const channel = block.network[networkAlias]
    const remote = remoteModel.create(channel)
    const network = { [networkAlias]: remote }
    const interblock = { provenance, proof, network }
    if (turnovers.length) {
      interblock.turnovers = turnovers
    }
    const clone = interblockModel.clone(interblock)
    return clone
  },

  logicize(instance) {
    const { provenance, proof, network, turnovers = [] } = instance

    // TODO assert(provenance.dmzIntegrity.hash === proof)
    assert.strictEqual(Object.keys(network).length, 1) // TODO handle multiple
    const originAlias = Object.keys(network)[0]
    const tx = network[originAlias]
    assert(remoteModel.isModel(tx))
    const { address, replies, requests, precedent } = tx
    assert(address.isResolved())
    const msg = `Interblocks must always transmit something`
    assert(Object.keys(replies).length || requests.length, msg)
    if (precedent.isUnknown() && !provenance.address.isGenesis()) {
      assert(turnovers.length, `new channel must supply turnovers`)
    }

    let extractedGenesis
    const extractGenesis = () => {
      if (requests[0] && requests[0].payload.genesis) {
        if (!extractedGenesis) {
          // TODO move to producers and handle minimal payload

          const genesis = blockModel.clone(requests[0].payload.genesis)
          assert(genesis.provenance.address.isGenesis())
          extractedGenesis = genesis
        }
      }
      return extractedGenesis
    }
    const getTargetAddress = () => address
    const getOriginAlias = () => originAlias
    const getRemote = () => tx

    const isConnectionAttempt = () => {
      const request = tx.requests[0]
      const isSingleRequest = tx.requests.length === 1
      if (request && request.type === '@@INTRO' && isSingleRequest) {
        // TODO check no replies back yet
        return true
      }
    }
    const isGenesisAttempt = () => {
      try {
        return !!extractGenesis()
      } catch (e) {
        return false
      }
    }
    const isConnectionResponse = () => {
      // TODO handle covenant renaming incoming conneciton before first transmission
      // or outlaw it
      // TODO totally broken
      const isAliasMatch = originAlias.startsWith('@@PUBLIC_')
      const chainId = originAlias.substring('@@PUBLIC_'.length)
      const isAddress = isAliasMatch && chainId === address.getChainId()
      const accept = requests[0]
      const isRequests = accept && accept.type === '@@ACCEPT'
      const isRepliesBlank = !Object.keys(replies).length
      return isAddress && isRequests && isRepliesBlank
    }
    const isConnectionResolve = () => {
      if (!isConnectionAttempt()) {
        return false
      }
      const resolve = replies[0]
      if (resolve) {
        assert(continuationModel.isModel(resolve))
        return resolve.isResolve()
      }
    }
    const isDownlinkInit = () => requests[0] && !Object.keys(replies).length // TODO beware wrap around
    // TODO cannot deduce this without access to the source block
    // or some member of which chains have had lineage sent
    const isUplinkInit = () => replies[0] && !Object.keys(requests).length // TODO beware wrap around
    const getChainId = () => provenance.getAddress().getChainId()
    return {
      extractGenesis,
      getTargetAddress,
      getOriginAlias,
      getRemote,
      isConnectionAttempt,
      isGenesisAttempt,
      isConnectionResponse,
      isConnectionResolve,
      isDownlinkInit,
      isUplinkInit,
      getChainId,
    }
  },
})

export { interblockModel }
