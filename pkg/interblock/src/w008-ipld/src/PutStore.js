import { Block, create } from 'multiformats/block'
import { hasher } from './IpldUtils'
import * as codec from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:models:putstore')

export class PutStore {
  #putsMap = new Map()
  #getsMap = new Map() // used as a cache
  #ipfsResolver
  #untrimmed = false
  constructor(resolver, previous) {
    assert.strictEqual(typeof resolver, 'function')
    this.#ipfsResolver = resolver
    if (previous) {
      assert(previous instanceof PutStore)
      this.#getsMap = previous.#putsMap
    }
  }
  clone() {
    const next = new this.constructor(this.#ipfsResolver)
    next.#putsMap = new Map(this.#putsMap)
    next.#getsMap = new Map(this.#getsMap)
    next.#untrimmed = this.#untrimmed
    return next
  }
  async get(cid) {
    // used by js-ipld-hamt
    assert(CID.asCID(cid))
    debug('get:', cid.toString().substring(0, 9))
    const block = await this.getBlock(cid)
    return block.bytes
  }
  async put(cid, bytes) {
    // used by js-ipld-hamt
    assert(CID.asCID(cid))
    assert(bytes instanceof Uint8Array)
    this.#untrimmed = true
    if (this.#putsMap.has(cid.toString())) {
      return
    }
    const block = await create({ bytes, cid, hasher, codec })
    return this.putBlock(cid, block)
  }
  async getBlock(cid) {
    assert(CID.asCID(cid))
    debug('getBlock:', cid.toString().substring(0, 9))
    if (this.#putsMap.has(cid.toString())) {
      return this.#putsMap.get(cid.toString())
    }
    if (this.#getsMap.has(cid.toString())) {
      return this.#getsMap.get(cid.toString())
    }
    if (!this.#ipfsResolver) {
      throw new Error('No ipfs resolver set')
    }
    const block = await this.#ipfsResolver(cid)
    if (!block) {
      throw new Error(`No block found for ${cid}`)
    }
    return block
  }
  putBlock(cid, block) {
    assert(CID.asCID(cid))
    assert(block instanceof Block)
    assert(!this.#putsMap.has(cid.toString()))
    debug('put: ', cid.toString().substring(0, 9))
    this.#putsMap.set(cid.toString(), block)
  }
  hasBlock(cid) {
    assert(CID.asCID(cid))
    return this.#putsMap.has(cid.toString())
  }
  trim(cid) {
    assert(CID.asCID(cid), `must pass rootCid`)
    assert(this.#putsMap.has(cid.toString()), `Missing hamt root ${cid}`)
    const diffs = new Map()
    let links = [cid]
    while (links.length) {
      const nextLinks = []
      for (const cid of links) {
        assert(CID.asCID(cid))
        const cidString = cid.toString()
        if (this.#putsMap.has(cidString)) {
          const block = this.#putsMap.get(cidString)
          diffs.set(cidString, block)
          for (const [, childCid] of block.links()) {
            nextLinks.push(childCid)
          }
        }
      }
      links = nextLinks
    }
    this.#putsMap = diffs
    this.#untrimmed = false
  }
  getDiffBlocks(cid) {
    assert(CID.asCID(cid), `must pass rootCid`)
    assert(this.#putsMap.has(cid.toString()), `Missing hamt root ${cid}`)
    assert(!this.#untrimmed, `Must call trim() before getDiffs()`)
    return this.#putsMap
  }
}
