import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { encode, Block } from 'multiformats/block'
import { IpldInterface } from './IpldInterface'
import * as codec from 'multiformats/codecs/raw'
import { sha256 as hasher } from 'multiformats/hashes/sha2'

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
    assert.strictEqual(ipldBlock.value, ipldBlock.bytes)
    const instance = new this()
    instance.#ipldBlock = ipldBlock
    instance.deepFreeze()
    IpldInterface.deepFreeze(ipldBlock)
    return instance
  }
  static async uncrush(rootCid, resolver, options) {
    assert(rootCid instanceof CID, `rootCid must be a CID, got ${rootCid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)
    const ipldBlock = await resolver(rootCid)
    return this.#create(ipldBlock)
  }
  isModified() {
    // TODO verify that the Uint8Array cannot be altered
    return false
  }
  get ipldBlock() {
    return this.#ipldBlock
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
