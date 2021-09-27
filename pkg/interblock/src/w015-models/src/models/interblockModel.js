import { assert } from 'chai/index.mjs'
import { standardize } from '../modelUtils'
import { continuationModel } from './continuationModel'
import { blockModel } from './blockModel'
import { channelModel } from './channelModel'
import { remoteModel } from './remoteModel'
import { interblockSchema } from '../schemas/modelSchemas'
import { proofModel } from './proofModel'
import Debug from 'debug'
const debug = Debug('interblock:models:interblock')

const interblockModel = standardize({
  schema: interblockSchema,
  create(block, networkAlias) {
    assert(blockModel.isModel(block))
    assertParams(block, networkAlias)

    const { provenance, validators } = block
    const proof = proofModel.create(block, networkAlias)

    const interblock = {
      provenance,
      proof,
      validators,
    }
    if (networkAlias) {
      const channel = block.network[networkAlias]
      assert(channelModel.isModel(channel))
      const remote = remoteModel.create(channel)
      interblock.network = { [networkAlias]: remote }
    }
    const clone = interblockModel.clone(interblock)
    return clone
  },

  logicize(instance) {
    const { provenance, proof, validators, network } = instance
    // TODO turn assertions back on
    // assert(provenance.dmzIntegrity.hash === integrity.hash)
    // TODO ensure proof is light if interblock is light

    // TODO check the provenance signatures match the validator requiprements
    // assert(integrity.checkEntryProof('validators', validators))
    const originAlias = network && Object.keys(network)[0]
    const remote = originAlias && network[originAlias]
    assert(!remote || remoteModel.isModel(remote))
    if (originAlias) {
      assert.strictEqual(Object.keys(network).length, 1)
      const channel = network[originAlias]
      // TODO check the integrity proof covers all data in the interblock
      // assert(integrity.checkEntryProof('network', originAlias, channel))
      assert(
        !channel.address.isUnknown(),
        'interblock transmission address must be known'
        // TODO this is an excessive requirement
      )
    } else {
      assert(!network)
    }

    let extractedGenesis
    const extractGenesis = () => {
      if (!extractedGenesis) {
        const genesis = blockModel.clone(remote.requests[0].payload.genesis)
        assert(genesis.provenance.address.isGenesis())
        extractedGenesis = genesis
      }
      return extractedGenesis
    }
    const getTargetAddress = () =>
      // TODO remove as unused, so can scavenge blocks between chains
      remote && remote.address
    const getOriginAlias = () => originAlias
    const getRemote = () => remote
    let withoutRemote
    const getWithoutRemote = () => {
      if (!withoutRemote) {
        const proof = { block: instance.proof.block }
        const next = { ...instance, proof }
        delete next.network
        withoutRemote = interblockModel.clone(next)
      }
      return withoutRemote
    }
    const getLineageHeight = () => {
      return remote.lineageHeight
    }
    const getHeavyHeight = () => {
      // TODO include validator change detection
      return remote.heavyHeight
    }
    const isConnectionAttempt = () => {
      if (!remote) {
        return false
      }
      const request = remote.requests[0]
      const isSingleRequest = remote.requests.length === 1
      if (request && request.type === '@@INTRO' && isSingleRequest) {
        // TODO check no replies back yet, and no lineage back yet, using heights
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
      // TODO convert to an object prototype with comparison
      if (!remote) {
        return false
      }
      assert(remote && originAlias)
      const isBlankLineage =
        remote.lineageHeight === -1 && remote.heavyHeight === -1
      const isAliasMatch = originAlias.startsWith('@@PUBLIC_')
      const chainId = originAlias.substring('@@PUBLIC_'.length)
      const isAddress = isAliasMatch && chainId === remote.address.getChainId()
      const accept = remote.requests[0]
      const isRequests = accept && accept.type === '@@ACCEPT'
      const isRepliesBlank = !Object.keys(remote.replies).length
      return isBlankLineage && isAddress && isRequests && isRepliesBlank
    }
    const isConnectionResolve = () => {
      if (!isConnectionAttempt()) {
        return false
      }
      const resolve = remote.replies[0]
      if (resolve) {
        assert(continuationModel.isModel(resolve))
        return resolve.isResolve()
      }
    }
    const isDownlinkInit = () => {
      if (!remote) {
        return false
      }
      const isFirstRequest =
        remote.requests[0] && !Object.keys(remote.replies).length // TODO beware wrap around
      const isNoLineageReceived = remote.heavyHeight < 0
      return isFirstRequest && isNoLineageReceived
    }
    const isUplinkInit = () => {
      // TODO cannot deduce this without access to the source block
      // or some member of which chains have had lineage sent
      if (!remote) {
        return false
      }
      const isFirstReply =
        remote.replies[0] && !Object.keys(remote.requests).length // TODO beware wrap around
      return isFirstReply
    }
    const getChainId = () => provenance.getAddress().getChainId()
    return {
      extractGenesis,
      getTargetAddress,
      getOriginAlias,
      getRemote,
      isConnectionAttempt,
      isGenesisAttempt,
      getWithoutRemote,
      getLineageHeight,
      getHeavyHeight,
      isConnectionResponse,
      isConnectionResolve,
      isDownlinkInit,
      isUplinkInit,
      getChainId,
    }
  },
})

const assertParams = (block, targetAlias) => {
  if (targetAlias && typeof targetAlias !== 'string') {
    throw new Error(`Invalid format for target alias: ${targetAlias}`)
  }
  if (!block.isVerifiedBlock()) {
    throw new Error(`Only validated blocks can be reduced to Interblocks`)
  }
  if (targetAlias === '.') {
    throw new Error(`Cannot make interblock from loopback channel`)
  }
}

export { interblockModel }
