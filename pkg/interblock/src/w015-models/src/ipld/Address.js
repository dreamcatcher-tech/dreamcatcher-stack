import assert from 'assert-fast'
import * as crypto from '../../../w012-crypto'
import { CID } from 'multiformats/cid'
import { IpldInterface } from './IpldInterface'

const UNKNOWN = CID.create(0, 0, crypto.randomBytes(32))

export class Address extends IpldInterface {
  static create(cid) {
    assert(cid instanceof CID)

    if (typeof integrity !== 'string') {
      assert(integrity instanceof Integrity, `Wrong type: ${typeof integrity}`)
    }

    let status = `UNKNOWN`
    // TODO do not use Integrity if one of the predetermined types
    if (integrity === `GENESIS`) {
      // the source of randomness in genesis block creation
      status = `GENESIS_${crypto.generateNonce()}`
      // TODO define these types in Integrity too
      integrity = defaultIntegrity
    } else if (integrity === 'LOOPBACK') {
      status = 'LOOPBACK'
      integrity = defaultIntegrity
    } else if (integrity === 'ROOT') {
      status = 'ROOT'
      integrity = defaultIntegrity
    } else if (integrity === 'INVALID') {
      status = 'INVALID'
      integrity = defaultIntegrity
    } else if (typeof integrity === 'string') {
      if (integrity === 'TEST') {
        integrity = testIntegrity.hash
      }
      const hashLength = testIntegrity.hash.length // 64
      if (integrity.length === hashLength) {
        // TODO use a regex tester for chainIds
        const hashString = integrity
        integrity = Integrity.create(hashString)
        status = 'RESOLVED'
      } else {
        throw new Error(`Invalid integrity: ${integrity}`)
      }
    } else if (!integrity.isUnknown()) {
      status = `RESOLVED`
    }
    assert(integrity instanceof Integrity)
    return super.create({ chainId: integrity, status })
  }
  getChainId() {
    if (this.status === 'LOOPBACK') {
      return 'LOOPBACK'
    }
    if (this.status === 'ROOT') {
      return 'ROOT'
    }
    if (this.status !== 'RESOLVED') {
      throw new Error(`Address not resolved: ${this.status}`)
    }
    return this.chainId.hash
  }
  // TODO broaden isResolved to cover root and loopback cases
  isRoot() {
    return this.status === 'ROOT'
  }
  isLoopback() {
    return this.status === 'LOOPBACK'
  }
  isGenesis() {
    return this.status.startsWith('GENESIS_')
  }
  isUnknown() {
    return this.status === 'UNKNOWN'
  }
  isResolved() {
    return this.status === 'RESOLVED'
  }
  isInvalid() {
    return this.status === 'INVALID'
  }
}
