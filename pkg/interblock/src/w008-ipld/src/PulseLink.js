import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Pulse, Address } from '.'
import { IpldInterface } from './IpldInterface'
/**
type PulseLink link
 */

export class PulseLink extends IpldInterface {
  #cid
  #bakedPulse
  static createCrossover(address) {
    assert(address instanceof Address)
    assert(address.isResolved())
    const instance = new this()
    instance.#setCid(address.cid.toV1())
    return instance
  }
  static parse(data) {
    let cid
    if (ArrayBuffer.isView(data)) {
      cid = CID.decode(data)
    } else if (CID.asCID(data)) {
      cid = CID.asCID(data)
    } else {
      assert.strictEqual(typeof data, 'string')
      assert(data)
      cid = CID.parse(data)
    }
    assert.strictEqual(cid.version, 1)
    return this.uncrush(cid)
  }
  static generate(pulse) {
    assert(pulse instanceof Pulse)
    if (pulse.isModified() && !pulse.currentCrush) {
      throw new Error(`Pulse must be crushed already`)
    }
    const instance = new this()
    instance.#setCid(pulse.currentCrush.cid)
    return instance
  }
  #setCid(cid) {
    assert(!this.#cid)
    cid = CID.asCID(cid)
    assert(cid, `cid must be a CID`)
    assert(cid.version === 1)
    this.#cid = cid
  }
  static uncrush(cid) {
    assert(CID.asCID(cid))
    const instance = new this()
    instance.#setCid(cid)
    return instance
  }
  isModified() {
    return false
  }
  get cid() {
    return this.#cid
  }
  get asString() {
    return this.toString()
  }
  toString() {
    return `PulseLink(${this.cid.toString().substring(6, 15)})`
  }
  crush() {
    return this
  }
  getDiffBlocks() {
    return new Map()
  }
  equals(other) {
    if (!other) {
      return false
    }
    assert(other instanceof PulseLink)
    return this.#cid.equals(other.#cid)
  }
  export() {}
}

export class HistoricalPulseLink extends PulseLink {
  static fromPulseLink(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    return this.parse(pulseLink.cid)
  }
  toString() {
    return `HPulseLink(${this.cid.toString().substring(6, 15)})`
  }
}
