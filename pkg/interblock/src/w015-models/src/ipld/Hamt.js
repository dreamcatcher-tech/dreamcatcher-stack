/**
 * Wrapper around the hamt module from ipld.
 */
import Immutable from 'immutable'
import { IpldInterface } from './IpldInterface'
import { create, load } from 'ipld-hashmap'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import assert from 'assert-fast'

export class Hamt extends IpldInterface {
  #store = {
    map: new Map(),
    get(k) {
      console.log('get:', k)
      return store.map.get(k.toString())
    },
    put(k, v) {
      console.log('put: ', k)
      console.dir(v, { depth: Infinity })
      this.map.set(k.toString(), v)
    },
  }
  #map
  #valueClass
  static create(valueClass) {
    // only create the hamt on crush()
    const instance = new this()
    instance.#valueClass = valueClass
    return instance
    // instance.#map = await create(instance.#store, {
    //   // bitWidth: 4,
    //   // bucketSize: 2,
    //   blockHasher,
    //   blockCodec,
    // })
  }
  #clone() {
    const next = new this.constructor()
    next.#store = this.#store
    next.#map = this.#map
    next.#valueClass = this.#valueClass
    return next
  }
  #sets = Immutable.Map()
  #deletes = Immutable.Set()
  #gets = Immutable.Map()
  set(key, value) {
    assert(typeof key !== undefined)
    key = key + ''
    if (this.#valueClass) {
      assert(value instanceof this.#valueClass)
    }
    const next = this.#clone()
    next.#sets = this.#sets.set(key, value)
    next.#deletes = this.#deletes.remove(key)
    next.#gets = this.#gets.set(key, value)
    return next
  }
  delete(key) {
    assert(typeof key !== undefined)
    key = key + ''

    const next = this.#clone()
    next.#gets = this.#gets.remove(key)
    next.#sets = this.#sets.remove(key)
    next.#deletes = this.#deletes.add(key)
    return next
  }
  get(key) {
    assert(typeof key !== undefined)
    key = key + ''
    if (!this.#gets.has(key)) {
      throw new Error(`${key} has not been preloaded`)
    }
    return this.#gets.get(key)
  }
  isModified() {
    return !!this.#sets.size || !!this.#deletes.size
  }
  get cid() {
    assert(this.#map)
    assert(!this.isModified())
    return this.#map.cid
  }
  get ipldBlock() {
    throw new Error('Not Implemented')
  }
  get crushedSize() {
    throw new Error('Not Implemented')
  }
  async crush() {
    let map = this.#map
    if (!map) {
      map = await create(this.#store, {
        // bitWidth: 4,
        // bucketSize: 2,
        blockHasher,
        blockCodec,
      })
    }
    for (const key of this.#deletes) {
      console.log(key)
      await map.delete(key)
    }
    for (const [key, value] of this.#sets) {
      console.log('set:', key, value)
      await map.set(key, value)
    }
    const next = this.#clone()
    next.#map = map
    next.#sets = this.#sets.clear()
    next.#deletes = this.#deletes.clear()
    return next
  }
  static uncrush() {
    throw new Error('Not Implemented')
  }
  getDiffBlocks() {
    // This only stores diff since the last call to crush()
  }
}
