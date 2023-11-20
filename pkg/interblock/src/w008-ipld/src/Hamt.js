import equals from 'fast-deep-equal'
import { toString } from 'uint8arrays/to-string'
import { Map as IMap, Set as ISet } from 'immutable'
import { IpldInterface } from './IpldInterface'
import { IpldStruct } from './IpldStruct'
import { create, load } from 'ipld-hashmap'
import { hasher as blockHasher } from './IpldUtils'
import * as blockCodec from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import assert from 'assert-fast'
import Debug from 'debug'
import { PutStore } from './PutStore'
const debug = Debug('interblock:models:hamt')

/**
 * Tweaks
 * hashBytes (seems private)
 * bitWidth max 16, recommended max 8
 * bucketSize seems can be as big as 30
 * from ipld-hashmap source bitwidth 5, bucketSize 3
 */
const hamtOptions = { blockHasher, blockCodec, bitWidth: 4, bucketSize: 8 }

export class Hamt extends IpldInterface {
  #valueClass
  #isMutable
  #putStore
  #hashmap
  #gets = IMap()
  #sets = IMap()
  #deletes = ISet()
  #bakedMap
  #bitWidth = hamtOptions.bitWidth
  #bucketSize = hamtOptions.bucketSize

  static create(valueClass, isMutable = false) {
    if (valueClass) {
      assert(valueClass.prototype instanceof IpldStruct, 'Not IpldStruct type')
    }
    const instance = new this()
    instance.#valueClass = valueClass
    instance.#isMutable = isMutable
    return instance
  }
  set bitWidth(bitWidth) {
    assert(Number.isInteger(bitWidth))
    assert(bitWidth > 2)
    assert(bitWidth < 17)
    this.#bitWidth = bitWidth
  }
  set bucketSize(bucketSize) {
    assert(Number.isInteger(bucketSize))
    assert(bucketSize > 1)
    this.#bucketSize = bucketSize
  }
  // TODO allow WeakGet, WeakEntries, to only give what is loaded
  #clone() {
    const next = new this.constructor()
    next.#valueClass = this.#valueClass
    next.#isMutable = this.#isMutable
    next.#putStore = this.#putStore && this.#putStore.clone()
    next.#gets = this.#gets
    next.#sets = this.#sets
    next.#deletes = this.#deletes
    next.#bitWidth = this.#bitWidth
    next.#bucketSize = this.#bucketSize
    if (this.#hashmap) {
      next.#hashmap = new this.#hashmap.constructor(this.#hashmap._iamap)
    }
    return next
  }
  toString() {
    return this.#gets.toJS()
  }
  async set(key, value) {
    assertKey(key)
    if (this.#valueClass) {
      assert(value instanceof this.#valueClass, `Not correct class type`)
    }
    if (!this.#isMutable && (await this.#has(key))) {
      throw new Error(`Cannot overwrite key: ${key}`)
    }
    const next = this.#clone()
    next.#gets = this.#gets.set(key, value)
    next.#sets = this.#sets.set(key, value)
    next.#deletes = this.#deletes.remove(key)
    return next
  }
  async delete(key) {
    assertKey(key)
    if (!(await this.#has(key))) {
      throw new Error(`non existent key: ${key}`)
    }
    const next = this.#clone()
    next.#gets = this.#gets.remove(key)
    next.#sets = this.#sets.remove(key)
    next.#deletes = this.#deletes.add(key)
    return next
  }
  async #has(key) {
    assertKey(key)
    if (this.#gets.has(key)) {
      return true
    }
    if (this.#deletes.has(key)) {
      return false
    }
    if (!this.#hashmap) {
      return false
    }
    return await this.#hashmap.has(key)
  }
  async has(key) {
    return await this.#has(key)
  }
  async get(key) {
    assertKey(key)
    if (!(await this.#has(key))) {
      throw new Error(`key not present: ${key}`)
    }
    if (this.#gets.has(key)) {
      return this.#gets.get(key)
    }
    let value = await this.#hashmap.get(key)
    assert(value !== undefined)
    if (this.#valueClass) {
      assert(CID.asCID(value))
      const { resolver } = this.#putStore
      value = await this.#valueClass.uncrush(value, resolver)
    }
    this.#gets = this.#gets.set(key, value)
    return value
  }
  async getBlock(key) {
    assertKey(key)
    assert(this.#valueClass, `no valueClass => no blocks: ${key}`)
    if (!(await this.#has(key))) {
      throw new Error(`key not present: ${key}`)
    }
    let cid = await this.#hashmap.get(key)
    assert(cid !== undefined)
    assert(CID.asCID(cid))
    const block = await this.#putStore.getBlock(cid)
    return block
  }
  isModified() {
    return !!this.#sets.size || !!this.#deletes.size || !this.#hashmap
  }
  get cid() {
    assert(this.#hashmap)
    assert(!this.isModified())
    return CID.asCID(this.#hashmap.cid)
  }
  get ipldBlock() {
    throw new Error('Not Implemented')
  }
  get crushedSize() {
    throw new Error('Not Implemented')
  }
  get isBakeSkippable() {
    return false
  }
  async crush(resolver = () => {}) {
    assert.strictEqual(typeof resolver, 'function')
    const next = this.#clone()
    if (!this.isModified()) {
      return next
    }
    let hashmap = next.#hashmap
    const putStore = new PutStore(resolver, next.#putStore)
    const options = {
      ...hamtOptions,
      bitWidth: this.#bitWidth,
      bucketSize: this.#bucketSize,
    }
    if (!hashmap) {
      hashmap = await create(putStore, options)
    } else {
      // TODO why reload it and kill all the caches ?
      hashmap = await load(putStore, hashmap.cid, options)
    }

    for (const key of next.#deletes) {
      debug(`delete`, key)
      if (!(await hashmap.has(key))) {
        throw new Error(`non existent key: ${key}`)
      }
      await hashmap.delete(key)
    }
    for (const [key, value] of next.#sets) {
      if (!this.#isMutable && (await hashmap.has(key))) {
        throw new Error(`cannot overwrite key: ${key}`)
      }
      if (next.#valueClass) {
        const crushed = await value.crushToCid(resolver)
        next.#gets = next.#gets.set(key, crushed)
        await hashmap.set(key, crushed.cid)
        const diffs = crushed.getDiffBlocks()
        for (const [, ipldBlock] of diffs) {
          if (!putStore.hasBlock(ipldBlock.cid)) {
            putStore.putBlock(ipldBlock)
          }
        }
      } else {
        await hashmap.set(key, value)
      }
    }
    putStore.trim(hashmap.cid)
    next.#hashmap = hashmap
    next.#sets = next.#sets.clear()
    next.#deletes = next.#deletes.clear()
    next.#putStore = putStore
    return next
  }
  static async uncrush(cid, resolver, { valueClass, isMutable } = {}) {
    assert(CID.asCID(cid), `rootCid must be a CID, got ${cid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)

    const instance = this.create(valueClass, isMutable)
    instance.#putStore = new PutStore(resolver)
    const hashmap = await load(instance.#putStore, cid, hamtOptions)
    instance.#hashmap = hashmap
    return instance
  }
  getDiffBlocks() {
    // This only stores diff since the last call to crush()
    assert(!this.isModified())
    assert(this.#hashmap)
    assert(this.#putStore)

    const { cid } = this
    debug(`get diff for CID`, cid)
    return this.#putStore.getDiffBlocks(cid)
  }
  /**
   * @returns {AsyncGenerator<[string, any]>}
   */
  entries() {
    // TODO use the caches here, and use readahead buffer
    assert(!this.isModified())
    return this.#hashmap.entries()
  }
  /**
   * Acucmulates and returns all the keys in an array
   */
  async allKeys() {
    const keys = []
    for await (const [key] of this.entries()) {
      keys.push(key)
    }
    return keys
  }
  async export(loggingResolver) {
    assert.strictEqual(typeof loggingResolver, 'function')
    assert(!this.isModified())
    assert(this.#hashmap)
    const unwalked = await this.constructor.uncrush(this.cid, loggingResolver)
    for await (const [key] of unwalked.entries()) {
      if (this.#valueClass) {
        const value = await this.get(key)
        assert(value instanceof IpldInterface)
        await value.export(loggingResolver)
      }
    }
  }
  get isClassed() {
    return !!this.#valueClass
  }
  async compare(other) {
    if (!other) {
      other = this.constructor.create(this.#valueClass, this.#isMutable)
      other = await other.crush()
    }
    assert(other instanceof this.constructor)
    assert(!this.isModified())
    assert(!other.isModified())

    const links = [{ cid: this.#hashmap.cid, otherCid: other.#hashmap.cid }]
    const mergedDiff = {
      added: new Set(),
      deleted: new Set(),
      modified: new Set(),
    }
    const updateModified = async (key) => {
      const value = await this.get(key)
      const otherValue = await other.get(key)
      if (!equals(value, otherValue)) {
        mergedDiff.modified.add(key)
      }
    }
    while (links.length > 0) {
      const { cid, otherCid } = links.shift()
      const v = safelyGetBlock(this.#putStore, cid)
      const oV = safelyGetBlock(other.#putStore, otherCid)

      const [value, otherValue] = await Promise.all([v, oV])
      const [, data] = value
      const [, otherData] = otherValue
      const max = Math.max(data.length, otherData.length)
      for (let i = 0; i < max; i++) {
        let patch
        const element = data[i]
        const otherElement = otherData[i]
        if (CID.asCID(element) || CID.asCID(otherElement)) {
          const isBothCid = CID.asCID(element) && CID.asCID(otherElement)
          if (isBothCid) {
            if (!CID.asCID(element).equals(otherElement)) {
              debug('different links found')
              links.push({ cid: element, otherCid: otherElement })
            }
          } else {
            debug('one link is not a CID', element, otherElement)
            // compare bucket against blank, then cid against blank
            links.push({
              cid: CID.asCID(element),
              otherCid: CID.asCID(otherElement),
            })
            patch = patchBuckets(element, otherElement)
          }
        } else {
          patch = patchBuckets(element, otherElement)
        }
        if (patch) {
          for (const key of patch.added) {
            if (mergedDiff.deleted.has(key)) {
              mergedDiff.deleted.delete(key)
              await updateModified(key)
            } else {
              mergedDiff.added.add(key)
            }
          }
          for (const key of patch.deleted) {
            if (mergedDiff.added.has(key)) {
              mergedDiff.added.delete(key)
              await updateModified(key)
            } else {
              mergedDiff.deleted.add(key)
            }
          }
          for (const key of patch.modified) {
            mergedDiff.modified.add(key)
          }
        }
      }
    }

    return mergedDiff
  }
  async walk() {
    const keys = await this.allKeys()
    for (const key of keys) {
      await this.get(key)
    }
  }
  cids() {
    assert(this.#hashmap)
    assert(!this.isModified())
    return this.#hashmap.cids()
  }
}
const safelyGetBlock = async (putStore, cid) => {
  if (!cid) {
    return [undefined, []]
  }
  const block = await putStore.getBlock(cid)
  assert(block)
  let { value } = block
  value = value.hamt ? value.hamt : value
  return value
}
const assertKey = (key) => {
  assert(key !== undefined)
  assert(key !== '')
  assert(typeof key === 'string' || Number.isInteger(key))
}
const patchBuckets = (bucket, otherBucket) => {
  bucket = Array.isArray(bucket) ? bucket : []
  otherBucket = Array.isArray(otherBucket) ? otherBucket : []

  const patch = compareBuckets(bucket, otherBucket)
  return patch
}
const compareBuckets = (bucket, otherBucket) => {
  const diff = { added: [], deleted: [], modified: [] }
  const map = bucketToMap(bucket)
  const otherMap = bucketToMap(otherBucket)

  otherMap.forEach((value, key) => {
    if (!map.has(key)) {
      diff.deleted.push(key)
    }
  })
  map.forEach((value, key) => {
    if (!otherMap.has(key)) {
      diff.added.push(key)
    } else {
      const otherValue = otherMap.get(key)
      if (!equals(value, otherValue)) {
        diff.modified.push(key)
      }
    }
  })
  if (diff.added.length || diff.deleted.length || diff.modified.length) {
    debug('node was modified', diff)
    return diff
  }
}
const bucketToMap = (bucket) => {
  const map = new Map()
  if (!bucket) {
    return map
  }
  for (const [key, value] of bucket) {
    map.set(toString(key), value)
  }
  return map
}
