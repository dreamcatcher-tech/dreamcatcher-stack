import assert from 'assert-fast'
import * as crypto from '../../../w012-crypto'
import { Integrity } from '.'
import { addressSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'

const defaultIntegrity = Integrity.create()
const testIntegrity = Integrity.create('TEST')
export class Address extends mixin(addressSchema) {
  static create(integrity = defaultIntegrity) {
    let status = `UNKNOWN`
    // TODO do not use integrityModel if one of the predetermined types
    if (integrity === `GENESIS`) {
      // the source of randomness in genesis block creation
      status = `GENESIS_${crypto.generateNonce()}`
      // TODO define these types in integrityModel too
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
      if (integrity.startsWith('TEST')) {
        integrity = testIntegrity.hash
      }
      const possibleIntegrity = Integrity.create(integrity)
      if (possibleIntegrity.hash.length === integrity.length) {
        // TODO use a regex tester for chainIds
        const hash = integrity
        integrity = Integrity.create(hash)
        status = 'RESOLVED'
      } else {
        integrity = possibleIntegrity
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
  assertLogic() {}
}
