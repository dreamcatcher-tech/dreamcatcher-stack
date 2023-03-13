import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { encode, Block } from 'multiformats/block'
import { IpldInterface } from './IpldInterface'
import * as codec from 'multiformats/codecs/raw'
import { hasher } from './IpldUtils'
export class Binary extends IpldInterface {
  // TODO use the unixFS API so these objects are browseable
  #ipldBlock
  static async create(value) {
    assert(value instanceof Uint8Array)
    // TODO move to factory
    const ipldBlock = await encode({ value, codec, hasher })
    assert.strictEqual(ipldBlock.value, value)
    return this.#create(ipldBlock)
  }
  static #create(ipldBlock) {
    assert(ipldBlock instanceof Block, `#create requires a Block`)
    assert(ipldBlock.value.every((b, i) => b === ipldBlock.bytes[i]))
    const instance = new this()
    instance.#ipldBlock = ipldBlock
    return instance
  }
  static async uncrush(rootCid, resolver) {
    assert(CID.asCID(rootCid), `rootCid must be a CID, got ${rootCid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)
    const [ipldBlock] = await resolver(rootCid, { noObjectCache: true })
    return this.#create(ipldBlock)
  }
  isModified() {
    // TODO verify that the Uint8Array cannot be altered
    return false
  }
  get ipldBlock() {
    return this.#ipldBlock
  }
  toString() {
    return `Binary(${this.cid.toString().substring(0, 14)})`
  }
  crush() {
    return this
  }
  getDiffBlocks(from) {
    if (this === from) {
      return new Map()
    }
    const blocks = new Map()
    blocks.set(this.ipldBlock.cid.toString(), this.ipldBlock)
    return blocks
  }
}
