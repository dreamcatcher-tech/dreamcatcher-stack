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
  async get() {
    // used by js-ipld-hamt
    throw new Error('Awaiting upstream fix')
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
    const [block] = await this.#ipfsResolver(cid, { noObjectCache: true })
    if (!block) {
      throw new Error(`No block found for ${cid}`)
    }
    return block
  }
  get resolver() {
    return this.#ipfsResolver
  }
  async put() {
    // used by js-ipld-hamt
    throw new Error('Awaiting upstream fix')
  }
  putBlock(block) {
    const { cid, bytes, value } = block
    assert(CID.asCID(cid))
    assert(bytes instanceof Uint8Array)
    assert.strictEqual(typeof value, 'object')
    debug('put: ', cid.toString().substring(0, 9))
    this.#untrimmed = true
    if (this.#putsMap.has(cid.toString())) {
      return
    }
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
