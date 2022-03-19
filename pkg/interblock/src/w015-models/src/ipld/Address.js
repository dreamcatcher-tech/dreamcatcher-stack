import assert from 'assert-fast'
import dagPB, { prepare } from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import { IpldInterface } from './IpldInterface'
import { sha256 } from 'multiformats/hashes/sha2'
import { Provenance } from '.'

export const cidV0FromString = (string) => {
  assert.strictEqual(typeof string, 'string')
  const bytes = dagPB.encode(prepare(string))
  const hash = sha256.digest(bytes)
  const cid = CID.createV0(hash)
  return cid
}
export const generateConstantCids = () => {
  const UNKNOWN = cidV0FromString('UNKNOWN')
  const ROOT = cidV0FromString('ROOT')
  const LOOPBACK = cidV0FromString('LOOPBACK')
  const INVALID = cidV0FromString('INVALID')
  const GENESIS = cidV0FromString('GENESIS')
  console.log({ UNKNOWN, ROOT, LOOPBACK, INVALID, GENESIS })
}
// generateConstantCids()

const UNKNOWN = CID.parse('QmVQEFQi81SSbZaezrm78p333EGeYzfEZyvCnX848KaMCw')
const ROOT = CID.parse('QmSawJHmTNpaUjDYWCE9RgoHTpKbi6JD7TuGESFbtZ4ZLc')
const LOOPBACK = CID.parse('Qme2gGBx8EnSrXc5shQF867KPQd4jwubNov67KEKZbo4p3')
const INVALID = CID.parse('QmYSWwmJ4w1pZ6igGRNKcVHpBU68iaumYEjsdbMpxfAQaj')
const GENESIS = CID.parse('QmZTKF2kuFHy8isKWXpNeNa5zjeJwsHUbPbTNF1fS8HkpB')

export class Address extends IpldInterface {
  static createUnknown() {
    return this.create(UNKNOWN)
  }
  static createRoot() {
    return this.create(ROOT)
  }
  static createLoopback() {
    return this.create(LOOPBACK)
  }
  static createInvalid() {
    return this.create(INVALID)
  }
  static createGenesis() {
    return this.create(GENESIS)
  }
  static generate(provenance) {
    assert(provenance instanceof Provenance)
    const { cid } = provenance
    return this.create(cid.toV0())
  }
  static create(cid) {
    const instance = new this()
    instance.#setCid(cid)
    instance.deepFreeze()
    return instance
  }
  #cid
  #setCid(cid) {
    assert(cid instanceof CID, `cid must be a CID, got ${cid}`)
    assert(cid.version === 0)
    this.#cid = cid
  }
  static async uncrush(rootCid, resolver, options) {
    return this.create(rootCid)
  }
  isModified() {
    return false
  }
  get ipldBlock() {
    throw new Error(`Address is not a block`)
  }
  get cid() {
    return this.#cid
  }
  crush() {
    return this
  }
  getDiffBlocks(from) {
    return new Map()
  }
  getChainId() {
    if (this.#cid === LOOPBACK) {
      return 'LOOPBACK'
    }
    if (this.#cid === ROOT) {
      return 'ROOT'
    }
    if (!this.isResolved()) {
      throw new Error(`Address not resolved: ${this.#cid}`)
    }
    return this.#cid.toString()
  }
  // TODO broaden isResolved to cover root and loopback cases
  isRoot() {
    return this.#cid === ROOT
  }
  isLoopback() {
    return this.#cid === LOOPBACK
  }
  isGenesis() {
    return this.#cid === GENESIS
  }
  isUnknown() {
    return this.#cid === UNKNOWN
  }
  isInvalid() {
    return this.#cid === INVALID
  }
  isResolved() {
    return !this.isUnknown() && !this.isInvalid() && !this.isGenesis()
  }
}
