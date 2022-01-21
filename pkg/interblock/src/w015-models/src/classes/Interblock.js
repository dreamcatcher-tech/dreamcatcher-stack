import assert from 'assert-fast'
import {
  Block,
  Continuation,
  CovenantId,
  Dmz,
  Proof,
  Provenance,
  Remote,
  Turnover,
} from '.'
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
  assertLogic() {
    const { provenance, proof, transmission, turnovers = [] } = this
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
    if (initialRequest) {
      const { type, payload } = initialRequest
      if (type !== '@@GENESIS') {
        return
      }
      const spawnKeys = [
        'provenance',
        'validators',
        'spawnOpts',
        'alias',
        'timestamp',
      ]
      for (const key of spawnKeys) {
        if (!payload[key]) {
          return
        }
      }
      if (Object.keys(payload).length !== spawnKeys.length) {
        return
      }
      if (!this.#extractedGenesis) {
        // TODO move to producers and handle minimal payload
        // TODO handle serialization of payload
        const provenance = Provenance.clone(payload.provenance)
        const covenantId = CovenantId.create('unity')
        const { validators, timestamp } = payload
        const childDmz = Dmz.create({
          covenantId,
          ...payload.spawnOpts,
          validators,
          timestamp,
        })
        const genesis = Block.create().updateBlock(childDmz, provenance)
        assert(genesis.provenance.address.isGenesis())
        this.#extractedGenesis = genesis
      }
      return this.#extractedGenesis
    }
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
  static getIgniter() {
    return super.create(prebuiltInterblock)
  }
}

const prebuiltInterblock = {
  provenance: {
    dmzIntegrity: {
      hash: '16e18b2510c8e15beb165a041bf24aff602b42a6220e9d992ce793c2a0df092b',
      algorithm: 'sha256',
    },
    height: 0,
    address: {
      chainId: {
        hash: 'd9ebd32bacad329c70169da1e55c72d044e4ce0b93b3a11b942b6d3027d0ee74',
        algorithm: 'sha256',
      },
      status: 'GENESIS_8d601ec4-ac6b-4e43-8345-dce986e65685',
    },
    lineage: {},
    integrity: {
      hash: 'c8ac8e773ec1ec3ad2d9f634bc9216a89bab1c3ce540ee2384138cad2718c59e',
      algorithm: 'sha256',
    },
    signatures: [],
  },
  proof: {
    block: 'no proof needed',
  },
  transmission: {
    address: {
      chainId: {
        hash: '9f71f58cf978462ffdbce6d07bdede517718acde35d240139732145b040497fa',
        algorithm: 'sha256',
      },
      status: 'RESOLVED',
    },
    replies: {},
    requests: [
      {
        type: 'REMOTE_ACTION',
        payload: {},
      },
    ],
    precedent: {
      hash: 'UNKNOWN',
      algorithm: 'sha256',
    },
  },
}
