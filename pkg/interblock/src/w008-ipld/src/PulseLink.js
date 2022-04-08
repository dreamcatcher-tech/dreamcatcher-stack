import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Pulse } from '.'
import { IpldInterface } from './IpldInterface'
/**
type PulseLink link
 */

export class PulseLink extends IpldInterface {
  #cid
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
  crush() {
    return this
  }
  getDiffBlocks() {
    const map = new Map()
    return map
  }
}
