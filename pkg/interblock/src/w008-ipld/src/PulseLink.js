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
  static generate(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified(), `Pulse must be crushed already`)
    const instance = new this()
    instance.#setCid(pulse.cid)
    return instance
  }
  #setCid(cid) {
    assert(cid instanceof CID, `cid must be a CID, got ${cid}`)
    assert(cid.version === 1)
    this.#cid = cid
  }
  static async uncrush(rootCid, resolver, options) {
    assert(rootCid instanceof CID)
    const instance = new this()
    instance.#setCid(rootCid)
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
    const map = new Map()
    return map
  }
}
