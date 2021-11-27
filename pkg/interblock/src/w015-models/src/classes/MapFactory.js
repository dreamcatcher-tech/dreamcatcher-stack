/**
 * The benefit this approach hinges upon is structural sharing.
 *
 * Why ?
 *  - Do diff tracking during the block making process, so at block time the
 *    diffs are quick to calculate.  Makes the diffs guaranteed to be minimum
 *    possible required
 *  - Do structural sharing between blocks since we want to keep them in cache
 *  - Have immutable behaviours
 *  - Be quick to boot up
 *  - Be able to revive from a POJO and check against a schema plus some logic
 *    checks
 *  - Rapidly calculate hash for large objects, based only on what changed
 *  - Hashing slightly faster since no sort on the object keys required
 *
 * Other implementations of a similar approach:
 *  - https://google.github.io/flatbuffers/index.html#flatbuffers_overview
 *  - https://github.com/Bnaya/objectbuffer
 *  - https://github.com/GoogleChromeLabs/buffer-backed-object#readme
 *
 * Other benefits of this approach can be making objects that are backed
 * by ArrayBuffers for zerocopy transfer between webworkers.
 *
 * Why not manually create each class ?
 *  - this can be error prone, fiddly to update
 *  - huge amount of repetition
 *  - we can leverage the schemas as being all that is needed to spec the model
 *    system.
 */

import assert from 'assert-fast'
import Immutable from 'immutable'
import { MerkleArray } from './MerkleArray'
import * as Models from '.'
import Debug from 'debug'
const debug = Debug('interblock:classes:MapFactory')

const EMPTY = Symbol('EMPTY')
export const mixin = (schema) => {
  // TODO detect collisions with functions
  // if patternProperties, then we behave like a map
  // if normal properties, be an object with fixed props
  // if array, be a merklearray ?
  assert(!schema.properties || !schema.patternProperties, 'cannot have both')
  if (schema.properties) {
    return properties(schema)
  }
  if (schema.patternProperties) {
    return patternProperties(schema)
  }
  throw new Error('unsupported schema')
}
const Base = class {}
const patternProperties = (schema) => {
  // behave like a map
  const { patternProperties } = schema
  assert.strictEqual(Object.keys(patternProperties).length, 1)
  const regex = new RegExp(Object.keys(patternProperties).pop())

  const backingArray = new MerkleArray()
  const SyntheticMap = class extends Base {
    #backingArray = backingArray
    #map = Immutable.Map()
    static create(map) {
      const instance = new this(insidersOnly).setMany(map).merge()
      return instance
    }
    setMany(map) {
      // TODO use the bulkAdd method on MerkleArray with a bulkPut option
      let next = this
      for (const [key, value] of Object.entries(map)) {
        next = next.set(key, value)
      }
      return next
    }
    set(key, value) {
      assert(typeof key, 'string')
      assert(value !== undefined)
      assert(regex.test(key), `key ${key} does not match ${regex}`)
      const next = this.#clone()
      let index = next.#backingArray.size
      if (next.#map.has(key)) {
        index = next.#map.get(key)
        next.#backingArray = next.#backingArray.put(index, value)
      } else {
        next.#backingArray = next.#backingArray.add(value)
      }
      return next
    }
    remove(key) {
      assert(typeof key, 'string')
      assert(this.#map.has(key))
      const next = this.#clone()
      next.#backingArray = next.#backingArray.remove(this.#map.get(key))
      return next
    }
    #clone() {
      const next = new this.constructor()
      next.#backingArray = this.#backingArray
      next.#map = this.#map
      return next
    }
    merge() {
      const next = new this.constructor(
        insidersOnly,
        this.#backingArray.merge()
      )
      return next
    }
    get(key) {
      if (this.#map.has(key)) {
        return this.#backingArray.get(this.#map.get(key))
      }
    }
    has(key) {
      return this.#map.has(key)
    }
    toJS() {
      const js = {}
      for (const [key, index] of this.#map.entries()) {
        const value = this.#backingArray.get(index)
        if (value instanceof Base) {
          js[key] = value.toJS()
        } else {
          js[key] = value
        }
      }
      return js
    }
  }
  const className = schema.title || 'SyntheticMap'
  Object.defineProperty(SyntheticMap, 'name', { value: className })
  return SyntheticMap
}
const insidersOnly = Symbol()
const properties = (schema) => {
  assert(schema.properties)
  const propMap = {}

  const props = Object.keys(schema.properties)
  props.sort()
  const deepIndices = []
  const merkleOptions = { noCompaction: true, flatTree: true }
  const emptyArray = props.map(() => EMPTY)
  const backingArray = new MerkleArray(emptyArray, merkleOptions)
  const SyntheticObject = class extends Base {
    #backingArray = backingArray
    static create(params = {}) {
      const instance = new this(insidersOnly).update(params).merge()
      return instance
    }
    static restore(backingArray) {
      assert(Array.isArray(backingArray))
      backingArray = [...backingArray] // TODO use immutable here
      for (const { index, property } of deepIndices) {
        const Class = Models[property.title] || SyntheticObject
        assert(Class, `${property.title} not found`)
        backingArray[index] = Class.restore(backingArray[index])
      }
      const restored = new this(insidersOnly, backingArray)
      // TODO check the schema matches against the restored data
      if (typeof restored.assertLogic === 'function') {
        restored.assertLogic()
      }
      return restored
    }
    constructor(LOCKED_CONSTRUCTOR, backingArray) {
      super()
      if (LOCKED_CONSTRUCTOR !== insidersOnly) {
        throw new Error('Locked constructor - use static methods to instance')
      }
      if (backingArray) {
        if (backingArray instanceof MerkleArray) {
          this.#backingArray = backingArray
        } else {
          assert(Array.isArray(backingArray))
          this.#backingArray = new MerkleArray(backingArray, merkleOptions)
        }
      }
      Object.freeze(this)
    }
    get(index) {}
    update(obj) {
      assert.strictEqual(typeof obj, 'object')
      const entries = Object.entries(obj)
      if (!entries.length) {
        return this
      }

      let nextBackingArray = this.#backingArray
      for (const [propertyName, value] of entries) {
        assert(Number.isInteger(propMap[propertyName]), `${propertyName}`)
        assert(value !== undefined)
        debug(`set`, propertyName, value)
        const index = propMap[propertyName]
        // TODO use withMutations for speed
        nextBackingArray = nextBackingArray.put(index, value)
      }
      return new this.constructor(insidersOnly, nextBackingArray)
    }
    equals(other) {
      if (!(other instanceof this.constructor)) {
        return false
      }
      return this.#backingArray.equals(other.#backingArray)
    }
    deepEquals(other) {}
    merge() {
      const next = new this.constructor(
        insidersOnly,
        this.#backingArray.merge()
      )
      return next
    }
    hash() {
      return this.#backingArray.hash()
    }
    hashString() {
      return this.#backingArray.hashString()
    }
    toArray() {
      // TODO using the schema, know which elements a classes
      // pull them all out until always have js primitives
      const arr = this.#backingArray.toArray()
      for (const { index } of deepIndices) {
        // assert(arr[index] instanceof SyntheticObject)
        arr[index] = arr[index].toArray()
      }
      return arr
    }
    toJS() {
      const js = {}
      for (const [prop] of Object.entries(schema.properties)) {
        const index = propMap[prop]
        const value = this.#backingArray.get(index)
        if (value === EMPTY) {
          continue
        }
        if (value instanceof Base) {
          js[prop] = value.toJS()
        } else {
          js[prop] = value
        }
      }
      return js
    }
    static _defineProperties() {
      let index = 0
      for (const prop of props) {
        propMap[prop] = index++
        const property = schema.properties[prop]
        if (property.type === 'object') {
          deepIndices.push({ index: propMap[prop], property })
        }
        Object.defineProperty(SyntheticObject.prototype, prop, {
          enumerable: true,
          get() {
            const value = this.#backingArray.get(propMap[prop])
            if (value === EMPTY) {
              return undefined
            }
            return value
          },
        })
      }
    }
  }
  SyntheticObject._defineProperties()
  delete SyntheticObject._defineProperties
  const className = schema.title || 'SyntheticObject'
  Object.defineProperty(SyntheticObject, 'name', { value: className })

  return SyntheticObject
}
