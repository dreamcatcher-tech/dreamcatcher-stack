import * as Block from 'multiformats/block'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('interblock:models:putstore')

export class PutStore {
  #putsMap = new Map()
  #isGetsMode = false
  #ipfsResolver
  constructor(resolver) {
    this.#ipfsResolver = resolver
  }
  setGetMode() {
    this.#isGetsMode = true
  }
  setPutMode() {
    this.#isGetsMode = false
  }
  setIpfsResolver(resolver) {
    assert.strictEqual(typeof resolver, 'function')
    this.#ipfsResolver = resolver
  }
  get isModified() {
    return !!this.#putsMap.size
  }
  get(key) {
    assert(key instanceof CID)
    key = key.toString()
    debug('get:', key.substring(0, 9))
    if (!this.#isGetsMode) {
      if (this.#putsMap.has(key)) {
        return this.#putsMap.get(key)
      }
      throw new Error(`No gets in cache store for: ${key}`)
    }
    if (!this.#ipfsResolver) {
      throw new Error('No ipfs resolver set')
    }
    return this.#ipfsResolver(key)
  }
  put(key, value) {
    assert(key instanceof CID)
    assert(value instanceof Uint8Array)
    key = key.toString()
    if (this.#isGetsMode) {
      throw new Error('No puts in gets mode')
    }
    debug('put: ', key.substring(0, 9))
    this.#putsMap.set(key, value)
  }
  async getDiffs(cid) {
    assert(cid instanceof CID, `must pass rootCid`)
    assert(this.#putsMap.has(cid.toString()), `Missing hamt root ${cid}`)
    const diffs = new Map()
    const hasher = blockHasher
    const codec = blockCodec

    let links = [cid]
    while (links.length) {
      const nextLinks = []
      for (const cid of links) {
        assert(cid instanceof CID)
        const cidString = cid.toString()
        if (this.#putsMap.has(cidString)) {
          const bytes = this.#putsMap.get(cidString)
          const block = await Block.create({ bytes, cid, hasher, codec })
          diffs.set(cidString, block)
          let children = block.value[1]
          if (block.value.hamt) {
            children = block.value.hamt[1]
          }
          children = children.filter((v) => v instanceof CID)
          nextLinks.push(...children)
        }
      }
      links = nextLinks
    }
    return diffs
  }
}
