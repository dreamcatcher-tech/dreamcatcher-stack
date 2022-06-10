import Immutable from 'immutable'
import { IpldInterface } from './IpldInterface'
import { IpldStruct } from './IpldStruct'
import { create, load } from 'ipld-hashmap'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import assert from 'assert-fast'
import Debug from 'debug'
import { PutStore } from './PutStore'
const debug = Debug('interblock:models:hamt')

const hamtOptions = { blockHasher, blockCodec }
export class Hamt extends IpldInterface {
  #valueClass
  #isMutable
  #putStore
  #hashmap
  #gets = Immutable.Map()
  #sets = Immutable.Map()
  #deletes = Immutable.Set()
  static create(valueClass, isMutable = false) {
    if (valueClass) {
      assert(valueClass.prototype instanceof IpldStruct, 'Not IpldStruct type')
    }
    const instance = new this()
    instance.#valueClass = valueClass
    instance.#isMutable = isMutable
    return instance
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
    if (this.#hashmap) {
      next.#hashmap = new this.#hashmap.constructor(this.#hashmap._iamap)
    }
    return next
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
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
  delete(key) {
    assertKey(key)
    if (!this.#gets.has(key)) {
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
    let result = await this.#hashmap.get(key)
    assert(result !== undefined)
    if (this.#valueClass) {
      assert(result instanceof CID)
      const resolver = (cid) => this.#putStore.getBlock(cid)
      result = await this.#valueClass.uncrush(result, resolver)
    }
    this.#gets = this.#gets.set(key, result)
    return result
  }
  isModified() {
    return !!this.#sets.size || !!this.#deletes.size || !this.#hashmap
  }
  get cid() {
    assert(this.#hashmap)
    assert(!this.isModified())
    return this.#hashmap.cid
  }
  get ipldBlock() {
    throw new Error('Not Implemented')
  }
  get crushedSize() {
    throw new Error('Not Implemented')
  }
  async crush(resolver = () => {}) {
    assert.strictEqual(typeof resolver, 'function')
    const next = this.#clone()
    if (!this.isModified()) {
      return next
    }
    let hashmap = next.#hashmap
    const putStore = new PutStore(resolver, next.#putStore)
    if (!hashmap) {
      hashmap = await create(putStore, hamtOptions)
    } else {
      hashmap = await load(putStore, hashmap.cid, hamtOptions)
    }

    for (const key of next.#deletes) {
      debug(`delete`, key)
      if (!(await hashmap.has(key))) {
        throw new Error(`non existent key: ${key}`)
      }
      await hashmap.delete(key)
    }
    for (const [key, value] of next.#sets) {
      debug('set:', key, value)
      if (!this.#isMutable && (await hashmap.has(key))) {
        throw new Error(`cannot overwrite key: ${key}`)
      }
      if (next.#valueClass) {
        const crushed = await value.crush()
        next.#gets = next.#gets.set(key, crushed)
        await hashmap.set(key, crushed.cid)
        const diffs = await crushed.getDiffBlocks()
        for (const [, ipldBlock] of diffs) {
          if (!putStore.hasBlock(ipldBlock.cid)) {
            putStore.putBlock(ipldBlock.cid, ipldBlock)
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
  static async uncrush(cid, resolver, valueClass) {
    assert(cid instanceof CID, `rootCid must be a CID, got ${cid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)

    const instance = this.create(valueClass)
    instance.#putStore = new PutStore(resolver)
    const block = await resolver(cid)
    instance.#putStore.putBlock(cid, block)
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
    return this.#putStore.getDiffs(cid)
  }
}

const assertKey = (key) => {
  assert(key !== undefined)
  assert(key !== '')
  assert(typeof key === 'string' || Number.isInteger(key))
}
