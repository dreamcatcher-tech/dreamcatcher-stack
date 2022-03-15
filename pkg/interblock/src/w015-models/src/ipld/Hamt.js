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

export class Hamt extends IpldInterface {
  #valueClass
  #putStore = new PutStore()
  #hashmap
  #gets = Immutable.Map()
  #sets = Immutable.Map()
  #deletes = Immutable.Set()
  static create(valueClass) {
    if (valueClass) {
      assert(valueClass.prototype instanceof IpldStruct, 'Not IpldStruct type')
    }
    const instance = new this()
    instance.#valueClass = valueClass
    return instance
  }
  #clone() {
    const next = new this.constructor()
    next.#valueClass = this.#valueClass
    next.#putStore = this.#putStore
    next.#hashmap = this.#hashmap
    next.#gets = this.#gets
    next.#sets = this.#sets
    next.#deletes = this.#deletes
    return next
  }
  set(key, value) {
    assert(typeof key !== undefined)
    assert(typeof key === 'string' || Number.isInteger(key))
    key = key + ''
    if (this.#valueClass) {
      assert(value instanceof this.#valueClass, `Not correct class type`)
    }
    const next = this.#clone()
    next.#gets = this.#gets.set(key, value)
    next.#sets = this.#sets.set(key, value)
    next.#deletes = this.#deletes.remove(key)
    return next
  }
  delete(key) {
    assert(typeof key !== undefined)
    assert(typeof key === 'string' || Number.isInteger(key))
    key = key + ''

    const next = this.#clone()
    next.#gets = this.#gets.remove(key)
    next.#sets = this.#sets.remove(key)
    next.#deletes = this.#deletes.add(key)
    return next
  }
  get(key) {
    assert(typeof key !== undefined)
    assert(typeof key === 'string' || Number.isInteger(key))
    key = key + ''
    if (!this.#gets.has(key) || this.#deletes.has(key)) {
      throw new Error(`${key} has not been preloaded`)
    }
    return this.#gets.get(key)
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
  async crush() {
    if (!this.isModified()) {
      const next = this.#clone()
      next.#putStore = new PutStore()
      return this
    }
    this.#putStore.setPutMode()
    if (!this.#hashmap) {
      this.#hashmap = await create(this.#putStore, { blockHasher, blockCodec })
    }
    for (const key of this.#deletes) {
      console.log(key)
      await this.#hashmap.delete(key)
    }
    for (const [key, value] of this.#sets) {
      debug('set:', key, value)
      await this.#hashmap.set(key, value)
    }
    const next = this.#clone()
    next.#sets = this.#sets.clear()
    next.#deletes = this.#deletes.clear()
    return next
  }
  static async uncrush(cid, resolver, valueClass) {
    assert(cid instanceof CID, `rootCid must be a CID, got ${cid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)

    const instance = this.create(valueClass)
    instance.#putStore.setIpfsResolver(resolver)
    instance.#putStore.setGetMode()
    const hashmap = await load(instance.#putStore, cid, {
      blockHasher,
      blockCodec,
    })
    instance.#hashmap = hashmap
    return instance
  }
  async ensure(keys, resolver) {
    assert(Array.isArray(keys))
    assert(this.#hashmap)
    this.#putStore.setIpfsResolver(resolver)
    this.#putStore.setGetMode()
    keys = keys.filter((key) => !this.#gets.has(key))
    const awaits = keys.map(async (key) => {
      const object = await this.#hashmap.get(key)
      if (this.#valueClass) {
        return this.#valueClass.clone(object)
      }
      return object
    })
    const values = await Promise.all(awaits)
    const next = this.#clone()
    next.#gets = this.#gets.withMutations((gets) => {
      keys.forEach((key, index) => {
        const value = values[index]
        if (value === undefined) {
          throw new Error(`key: ${key} not in this map`)
        }
        gets.set(key, value)
      })
    })
    return next
  }
  getDiffBlocks() {
    // This only stores diff since the last call to crush()
    assert(!this.isModified())
    assert(this.#hashmap)
    assert(this.#putStore)

    const { cid } = this
    debug(`get diff for CID`, cid)
    if (!this.#putStore.isModified) {
      debug('no diffs detected')
      return new Map()
    }
    return this.#putStore.getDiffs(cid)
  }
}
