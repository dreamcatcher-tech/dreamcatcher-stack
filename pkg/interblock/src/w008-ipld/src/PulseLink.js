import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Pulse, Address } from '.'
import { IpldInterface } from './IpldInterface'
/**
type PulseLink link
 */

export class PulseLink extends IpldInterface {
  #cid
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
    assert(cid instanceof CID, `cid must be a CID, got ${cid}`)
    assert(cid.version === 1)
    this.#cid = cid
  }
  static uncrush(cid) {
    assert(cid instanceof CID)
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
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toString()
  }
  toString() {
    return `PulseLink(${this.cid.toString().substring(4, 14)})`
  }
  crush() {
    return this
  }
  getDiffBlocks() {
    return new Map()
  }
  equals(other) {
    assert(other instanceof PulseLink)
    return this.#cid.equals(other.#cid)
  }
}
