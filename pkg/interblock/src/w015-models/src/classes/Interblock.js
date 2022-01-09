import assert from 'assert-fast'
import { Block, Continuation, Proof, Remote, Turnover } from '.'
import { interblockSchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import Debug from 'debug'
const debug = Debug('interblock:classes:Interblock')

export class Interblock extends mixin(interblockSchema) {
  #extractedGenesis
  static create(block, networkAlias, turnovers = []) {
    // TODO allow multiple aliases
    assert(block instanceof Block)
    assert(block.isVerifiedBlock(), `Block must be verified`)
    assert.strictEqual(typeof networkAlias, 'string', `networkAlias not string`)
    assert(networkAlias !== '.', `Cannot make interblock from loopback channel`)
    assert(Array.isArray(turnovers))
    assert(turnovers.every((t) => t instanceof Turnover))
    assert(block.network.has(networkAlias), `${networkAlias} not in network`)

    const { provenance } = block
    const proof = Proof.create(block, networkAlias)
    const channel = block.network.get(networkAlias)
    const transmission = Remote.create(channel)
    const interblock = { provenance, proof, transmission }
    if (turnovers.length) {
      interblock.turnovers = turnovers
    }
    return super.create(interblock)
  }
  static clone(interblock) {
    return super.create(interblock)
  }
  assertLogic() {
    const { provenance, proof, transmission, turnovers = [] } = this
    debug(transmission)
    // TODO assert(provenance.dmzIntegrity.hash === proof)
    assert(transmission instanceof Remote)
    const { address, replies, requests, precedent } = transmission
    assert(address.isResolved())
    const msg = `Interblocks must always transmit something`
    assert(replies.size || requests.length, msg)
    if (precedent.isUnknown() && !provenance.address.isGenesis()) {
      assert(turnovers.length, `new channel must supply turnovers`)
    }
  }
  extractGenesis() {
    const initialRequest = this.transmission.requests[0]
    if (initialRequest && initialRequest.payload.genesis) {
      if (!this.#extractedGenesis) {
        // TODO move to producers and handle minimal payload
        // TODO handle serialization of payload
        const genesis = initialRequest.payload.genesis
        assert(genesis.provenance.address.isGenesis())
        this.#extractedGenesis = genesis
      }
    }
    return this.#extractedGenesis
  }
  getTargetAddress() {
    return this.transmission.address
  }

  isConnectionAttempt() {
    const request = this.transmission.requests[0]
    const isSingleRequest = this.transmission.requests.length === 1
    if (request && request.type === '@@INTRO' && isSingleRequest) {
      // TODO check no replies back yet
      return true
    }
  }
  isGenesisAttempt() {
    try {
      return !!this.extractGenesis()
    } catch (e) {
      return false
    }
  }
  isConnectionResponse() {
    // TODO handle covenant renaming incoming connection before first transmission
    // or outlaw it
    // TODO totally broken
    // const isAliasMatch = originAlias.startsWith('@@PUBLIC_')
    // const chainId = originAlias.substring('@@PUBLIC_'.length)
    // const isAddress = isAliasMatch && chainId === address.getChainId()
    // const accept = requests[0]
    // const isRequests = accept && accept.type === '@@ACCEPT'
    // const isRepliesBlank = !Object.keys(replies).length
    // return isAddress && isRequests && isRepliesBlank
  }
  isConnectionResolve() {
    if (!this.isConnectionAttempt()) {
      return false
    }
    const resolve = this.transmission.replies[0]
    if (resolve) {
      assert(resolve instanceof Continuation)
      return resolve.isResolve()
    }
  }
  isDownlinkInit() {
    const { requests, replies } = this.transmission
    return requests[0] && !Object.keys(replies).length // TODO beware wrap around
  }
  // TODO cannot deduce this without access to the source block
  // or some member of which chains have had lineage sent
  isUplinkInit() {
    // TODO beware wrap around
    const { requests, replies } = this.transmission
    return replies[0] && !Object.keys(requests).length
  }
  getChainId() {
    return this.provenance.getAddress().getChainId()
  }
}
