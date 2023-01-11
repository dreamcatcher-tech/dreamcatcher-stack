import assert from 'assert-fast'
import { encode, prepare } from '@ipld/dag-pb'
import { CID } from 'multiformats/cid'
import { Block } from 'multiformats/block'
import { IpldInterface } from './IpldInterface'
import { Pulse } from '.'
import { hasher } from './IpldUtils'

export const cidV0FromString = (string) => {
  assert.strictEqual(typeof string, 'string')
  const bytes = encode(prepare(string))
  const hash = hasher.digest(bytes)
  const cid = CID.createV0(hash)
  return cid
}
export const generateConstantCids = () => {
  const UNKNOWN = cidV0FromString('UNKNOWN')
  const ROOT = cidV0FromString('ROOT')
  const LOOPBACK = cidV0FromString('LOOPBACK')
  const INVALID = cidV0FromString('INVALID')
  const GENESIS = cidV0FromString('GENESIS')
  const IO = cidV0FromString('IO')
  console.log({ UNKNOWN, ROOT, LOOPBACK, INVALID, GENESIS, IO })
}
// generateConstantCids()

const UNKNOWN = CID.parse('QmVQEFQi81SSbZaezrm78p333EGeYzfEZyvCnX848KaMCw')
const ROOT = CID.parse('QmSawJHmTNpaUjDYWCE9RgoHTpKbi6JD7TuGESFbtZ4ZLc')
const LOOPBACK = CID.parse('Qme2gGBx8EnSrXc5shQF867KPQd4jwubNov67KEKZbo4p3')
const INVALID = CID.parse('QmYSWwmJ4w1pZ6igGRNKcVHpBU68iaumYEjsdbMpxfAQaj')
const GENESIS = CID.parse('QmZTKF2kuFHy8isKWXpNeNa5zjeJwsHUbPbTNF1fS8HkpB')
const IO = CID.parse('QmapFBxqMFEFxSqGE45yVYKid471NoegxSriH1GpCMfUa6')
const defines = [UNKNOWN, ROOT, LOOPBACK, INVALID, GENESIS, IO]

const addressBlock = (cidV1) => {
  assert(CID.asCID(cidV1))
  assert.strictEqual(cidV1.version, 1)
  const value = prepare({ Links: [cidV1] })
  const bytes = encode(value)
  const hash = hasher.digest(bytes)
  const cid = CID.createV0(hash)
  assert.strictEqual(cid.version, 0)
  return new Block({ cid, bytes, value })
}

export class Address extends IpldInterface {
  #cid
  static fromChainId(chainId) {
    assert.strictEqual(typeof chainId, 'string')
    assert(chainId)
    const cid = CID.parse(chainId)
    assert.strictEqual(cid.version, 0)
    const instance = new this()
    instance.#setCid(cid)
    return instance
  }
  static createCI(string = 'test') {
    assert.strictEqual(typeof string, 'string')
    assert(string)
    const value = prepare({ Data: string })
    const bytes = encode(value)
    const hash = hasher.digest(bytes)
    const cid = CID.createV0(hash)
    assert.strictEqual(cid.version, 0)
    const block = new Block({ cid, bytes, value })
    return Address.#createFromBlock(block)
  }
  static createUnknown() {
    return this.#createPredefined(UNKNOWN)
  }
  static createRoot() {
    return this.#createPredefined(ROOT)
  }
  static createLoopback() {
    return this.#createPredefined(LOOPBACK)
  }
  static createInvalid() {
    return this.#createPredefined(INVALID)
  }
  static createGenesis() {
    return this.#createPredefined(GENESIS)
  }
  static createIo() {
    return this.#createPredefined(IO)
  }
  static generate(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified(), `Pulse must be crushed already`)
    assert(pulse.isGenesis(), `Pulse must be genesis`)
    // TODO check the pulse is genesis
    const block = addressBlock(pulse.cid)
    return this.#createFromBlock(block)
  }
  static #createFromBlock(block) {
    assert(block instanceof Block)
    const instance = new this()
    instance.#setCid(block.cid)
    return instance
  }
  static #createPredefined(cid) {
    assert(defines.includes(cid), `not predefined`)
    const instance = new this()
    instance.#setCid(cid)
    return instance
  }
  #setCid(cid) {
    cid = CID.asCID(cid)
    assert(cid, `cid must be a CID`)
    assert(cid.version === 0)
    this.#cid = cid
  }
  static async uncrush(cid, resolver) {
    assert(CID.asCID(cid))
    assert.strictEqual(typeof resolver, 'function')
    for (const define of defines) {
      if (define.equals(cid)) {
        return this.#createPredefined(define)
      }
    }
    const instance = new this()
    instance.#setCid(cid)
    return instance
  }
  isModified() {
    return false
  }
  get ipldBlock() {
    throw new Error('no blocks in Addresses')
  }
  get cid() {
    return this.#cid
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }
  toString() {
    let string
    if (this.isUnknown()) {
      string = 'UNKNOWN'
    } else if (this.isRoot()) {
      string = 'ROOT'
    } else if (this.isLoopback()) {
      string = 'LOOPBACK'
    } else if (this.isInvalid()) {
      string = 'INVALID'
    } else if (this.isGenesis()) {
      string = 'GENESIS'
    } else if (this.isIo()) {
      string = 'IO'
    } else {
      string = this.cid.toString().substring(0, 9)
    }
    return `Address(${string})`
  }
  crush() {
    return this
  }
  getDiffBlocks() {
    return new Map()
  }
  equals(address) {
    assert(address instanceof Address)
    return this.cid.equals(address.cid)
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
  isIo() {
    return this.#cid === IO
  }
  isInvalid() {
    return this.#cid === INVALID
  }
  isResolved() {
    return !this.isUnknown() && !this.isInvalid() && !this.isGenesis()
  }
  isRemote() {
    return (
      this.isResolved() && !this.isRoot() && !this.isLoopback() && !this.isIo()
    )
  }
  export() {
    return
  }
}
