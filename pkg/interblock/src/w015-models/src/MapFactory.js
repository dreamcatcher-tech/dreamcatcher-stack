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
import { freeze } from 'immer'
import { MerkleArray } from './MerkleArray'
import * as Models from '..'
import equals from 'fast-deep-equal'
import Debug from 'debug'
const debug = Debug('interblock:classes:MapFactory')

const EMPTY = Symbol('EMPTY')
export const mixin = (schema) => {
  // TODO detect collisions with functions
  // if patternProperties, then we behave like a map
  // if normal properties, be an object with fixed props
  // if array, be a merklearray ?
  assert(!schema.properties || !schema.patternProperties, 'cannot have both')
  const deepFreeze = true
  freeze(schema, deepFreeze)
  if (schema.properties) {
    return properties(schema)
  }
  if (schema.patternProperties) {
    return patternProperties(schema)
  }
  throw new Error('unsupported schema')
}
export const Base = class {}
const patternProperties = (schema) => {
  // behave like a map
  const { patternProperties } = schema
  assert.strictEqual(Object.keys(patternProperties).length, 1)
  const regex = new RegExp(Object.keys(patternProperties).pop())
  const valueSchema = Object.values(patternProperties).pop()
  const patternName = valueSchema.title
  const Class = Models[patternName]
  assert(Class, 'Can only use pattern properties with titled schema')
  const emptyBackingArray = new MerkleArray()
  const SyntheticMap = class extends Base {
    #backingArray = emptyBackingArray
    #map = Immutable.OrderedMap()
    static get schema() {
      return schema
    }
    static create(map) {
      const instance = new this(insidersOnly).setMany(map).merge()
      if (typeof instance.assertLogic === 'function') {
        instance.assertLogic()
      }
      return instance
    }
    static restore(backingArray) {
      assert(Array.isArray(backingArray))
      let next = new this(insidersOnly)
      for (const [key, valueArray] of backingArray) {
        const value = Class.restore(valueArray)
        next = next.set(key, value)
      }
      next = next.merge()
      if (typeof next.assertLogic === 'function') {
        next.assertLogic()
      }
      return next
    }
    constructor(LOCKED_CONSTRUCTOR, backingArray) {
      if (LOCKED_CONSTRUCTOR !== insidersOnly) {
        throw new Error('Locked constructor - use static methods to instance')
      }
      super()
      if (backingArray) {
        if (backingArray instanceof MerkleArray) {
          this.#backingArray = backingArray
        } else {
          assert(Array.isArray(backingArray))
          this.#backingArray = new MerkleArray(backingArray)
        }
        // TODO rebuild the map with key names
      }
      Object.freeze(this)
    }
    setMany(map) {
      // TODO use the bulkAdd method on MerkleArray with a bulkPut option
      let next = this
      for (const [key, value] of Object.entries(map)) {
        next = next.set(key, value)
      }
      return next
    }
    update(map) {
      // TODO rename
      return this.setMany(map)
    }
    set(key, value) {
      assert(typeof key, 'string')
      assert(value !== undefined)
      assert(regex.test(key), `key ${key} does not match ${regex}`)
      assert(
        value instanceof Class,
        `key ${key} not instance of ${patternName} `
      )
      const tuple = [key, value]
      const next = this.#clone()
      if (next.#map.has(key)) {
        const index = next.#map.get(key)
        next.#backingArray = next.#backingArray.put(index, tuple)
      } else {
        next.#map = next.#map.set(key, next.#backingArray.size)
        next.#backingArray = next.#backingArray.add(tuple)
      }
      return next
    }
    clear() {
      const next = this.#clone()
      next.#backingArray = next.#backingArray.clear()
      next.#map = next.#map.clear()
      return next
    }
    remove(key) {
      assert(typeof key, 'string')
      assert(this.#map.has(key))
      const next = this.#clone()
      next.#backingArray = next.#backingArray.remove(this.#map.get(key))
      next.#map = next.#map.delete(key)
      return next
    }
    #clone() {
      const next = new this.constructor(insidersOnly)
      next.#backingArray = this.#backingArray
      next.#map = this.#map
      if (typeof this._imprint === 'function') {
        // TODO pass in old item into a constructor on the child instead
        this._imprint(next)
      }
      return next
    }
    merge(noArgsAllowed) {
      assert.strictEqual(noArgsAllowed, undefined, `no args to merge`)
      const next = this.#clone()
      const compactPlan = next.#backingArray.getCompactPlan()
      const reverse = new Map()
      for (const [key, index] of next.#map) {
        assert(!reverse.has(index))
        reverse.set(index, key)
      }
      for (const [to, from] of compactPlan) {
        assert(reverse.has(from), `missing ${from}`)
        const key = reverse.get(from)
        next.#map = next.#map.set(key, to)
      }
      next.#backingArray = next.#backingArray.compact().merge()
      return next
    }
    hash() {
      return this.#backingArray.hash()
    }
    hashString() {
      return this.#backingArray.hashString()
    }
    get(key) {
      assert.strictEqual(typeof key, 'string', `key ${key} is not a string`)
      if (this.#map.has(key)) {
        const index = this.#map.get(key)
        const [storedKey, value] = this.#backingArray.get(index)
        assert.strictEqual(storedKey, key)
        return value
      }
    }
    has(key) {
      return this.#map.has(key)
    }
    toJS() {
      const js = {}
      for (const [key, value] of this.entries()) {
        js[key] = value.toJS()
      }
      return js
    }
    toArray() {
      /**
       * Tested on serializing a network object with 20,000 channels.
       * JSON.stringify takes 23ms
       * jsonpack takes 14s but takes 5MB down to 2MB
       * fastJsonStringify takes 200ms
       * snappy compression in nodejs takes it down to 1MB in 9ms
       * snappyjs compression takes it down to 1MB is 72ms
       * zipson down to 1.3MB in 134ms
       */
      const array = this.#backingArray.toArray()
      return array.map(([key, value]) => [key, value.toArray()])
    }
    entries() {
      const keys = this.#map.keys()
      return {
        [Symbol.iterator]: () => ({
          next: () => {
            const { done, value: key } = keys.next()
            if (done) {
              return { done, value: undefined }
            }
            const value = this.get(key)
            return { done, value: [key, value] }
          },
        }),
      }
    }
    get size() {
      return this.#map.size
    }
    get _dump() {
      return this.toJS()
    }
    deepEquals(other) {
      if (!(other instanceof this.constructor)) {
        return false
      }
      if (this.#map.size !== other.#map.size) {
        return false
      }
      for (let i = this.#backingArray.size - 1; i >= 0; i--) {
        const [, thisValue] = this.#backingArray.get(i)
        const [, otherValue] = other.#backingArray.get(i)
        if (!thisValue.deepEquals(otherValue)) {
          return false
        }
      }
      return true
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

  const props = Object.keys(schema.properties).sort()
  const deepIndices = new Map()
  const merkleOptions = { noCompaction: true, flatTree: true }
  const emptyArray = props.map(() => EMPTY)
  const backingArray = new MerkleArray(emptyArray, merkleOptions)
  const SyntheticObject = class extends Base {
    #backingArray = backingArray
    static get schema() {
      return schema
    }
    static create(params = {}) {
      const instance = new this(insidersOnly).update(params).merge()
      if (typeof instance.assertLogic === 'function') {
        instance.assertLogic()
      }
      return instance
    }
    static restore(backingArray) {
      assert(Array.isArray(backingArray))
      // JSON.stringify converts symbol to null
      backingArray = backingArray.map((v) => (v === null ? EMPTY : v))
      for (const [index, schema] of deepIndices.entries()) {
        if (backingArray[index] === EMPTY) {
          continue
        }
        if (schema.type === 'array' && schema.items.type === 'string') {
          continue
        }
        const Class = getClassForSchema(schema)
        assert(Class, `${schema.title} not found`)
        let value = backingArray[index]
        if (schema.type === 'array') {
          assert(Array.isArray(value))
          value = value.map((v) => Class.restore(v))
        } else {
          assert.strictEqual(schema.type, 'object')
          value = Class.restore(value)
        }
        backingArray[index] = value
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
    update(obj) {
      assert.strictEqual(typeof obj, 'object')
      const entries = Object.entries(obj)
      if (!entries.length) {
        return this
      }

      let nextBackingArray = this.#backingArray
      for (let [propertyName, nextValue] of entries) {
        assert(Number.isInteger(propMap[propertyName]), `${propertyName}`)
        assert(nextValue !== undefined, `${propertyName}`)
        // TODO do type checking based on the schema, particularly if deep
        debug(`set`, propertyName, nextValue)
        const arrayIndex = propMap[propertyName]

        if (deepIndices.has(arrayIndex)) {
          const schema = deepIndices.get(arrayIndex)
          const currentValue = nextBackingArray.get(arrayIndex)
          nextValue = deepValue(schema, currentValue, nextValue)
        } else {
          const propertySchema = schema.properties[propertyName]
          if (propertySchema.type === 'object') {
            assert.strictEqual(typeof nextValue, 'object')
          } else if (propertySchema.type === 'string') {
            assert.strictEqual(typeof nextValue, 'string')
          } else if (propertySchema.type === 'integer') {
            assert(Number.isInteger(nextValue))
            const { minimum } = typeof propertySchema
            if (typeof minimum !== 'undefined') {
              assert(nextValue >= minimum, `minimum was: ${minimum}`)
            }
          } else if (propertySchema.enum) {
            const _enum = propertySchema.enum
            assert(_enum.includes(nextValue), `${_enum}`)
          } else if (propertySchema.type === 'boolean') {
            assert.strictEqual(typeof nextValue, 'boolean')
          } else {
            throw new Error(`invalid schema type ${propertySchema.type}`)
          }
        }
        // TODO use withMutations for speed
        nextBackingArray = nextBackingArray.put(arrayIndex, nextValue)
      }
      return new this.constructor(insidersOnly, nextBackingArray)
    }
    delete(propertyName) {
      assert(Number.isInteger(propMap[propertyName]), `${propertyName}`)
      assert(!schema.required.includes(propertyName), `${propertyName}`)
      const arrayIndex = propMap[propertyName]
      const nextBackingArray = this.#backingArray.put(arrayIndex, EMPTY)
      return new this.constructor(insidersOnly, nextBackingArray)
    }
    deepEquals(other) {
      if (this === other) {
        return true
      }
      if (!(other instanceof this.constructor)) {
        return false
      }
      if (this.#backingArray !== other.#backingArray) {
        return this.#deepEquals(other)
      }
      return true
    }
    #deepEquals(other) {
      for (let i = 0; i < this.#backingArray.size; i++) {
        const thisValue = this.#backingArray.get(i)
        const otherValue = other.#backingArray.get(i)
        if (thisValue === otherValue) {
          continue
        }
        if (!deepIndices.has(i)) {
          if (!equals(thisValue, otherValue)) {
            return false
          }
        } else {
          if (thisValue === EMPTY) {
            if (otherValue !== EMPTY) {
              return false
            }
          } else {
            const schema = deepIndices.get(i)
            if (schema.type === 'array') {
              if (thisValue.length !== otherValue.length) {
                return false
              }
              if (!thisValue.every((v, i) => v.deepEquals(otherValue[i]))) {
                return false
              }
            } else {
              assert.strictEqual(schema.type, 'object')
              if (!thisValue.deepEquals(otherValue)) {
                thisValue.deepEquals(otherValue)
                return false
              }
            }
          }
        }
      }
      return true
    }
    merge(noArgsAllowed) {
      assert.strictEqual(noArgsAllowed, undefined, `no args to merge`)
      let backingArray = this.#backingArray
      for (const [index, property] of deepIndices.entries()) {
        let deepValue = backingArray.get(index)
        if (deepValue === EMPTY) {
          continue
        }
        if (property.type === 'object') {
          deepValue = deepMerge(deepValue)
        } else {
          assert.strictEqual(property.type, 'array')
          const array = backingArray.get(index)
          assert(Array.isArray(array))
          deepValue = array.map((v) => deepMerge(v))
        }
        backingArray = backingArray.put(index, deepValue)
      }

      const next = new this.constructor(insidersOnly, backingArray.merge())
      return next
    }
    hashRaw() {
      return this.#backingArray.hash()
    }
    hashString() {
      return this.#backingArray.hashString()
    }
    serialize() {
      return JSON.stringify(this.toArray())
    }
    getSerializedSize() {
      return this.serialize().length
    }
    toArray() {
      // TODO cache the output in case called again
      // TODO using the schema, know which elements a classes
      // pull them all out until always have js primitives
      const array = this.#backingArray.toArray()
      for (const [index, property] of deepIndices.entries()) {
        if (array[index] === EMPTY) {
          continue
        }
        if (property.type === 'object') {
          array[index] = array[index].toArray()
        } else {
          assert.strictEqual(property.type, 'array')
          array[index] = array[index].map((v) => {
            if (typeof v.toArray === 'function') {
              return v.toArray()
            }
            return v
          })
        }
      }
      return array
    }
    toJS() {
      const js = {}
      for (const [prop] of Object.entries(schema.properties)) {
        const index = propMap[prop]
        const value = this.#backingArray.get(index)
        if (value === EMPTY) {
          continue
        }
        if (typeof value.toJS === 'function') {
          js[prop] = value.toJS()
        } else if (Array.isArray(value)) {
          js[prop] = value.map((v) => {
            if (typeof v.toJS === 'function') {
              return v.toJS()
            }
            return v
          })
        } else {
          js[prop] = value
        }
      }
      return js
    }
    get _dump() {
      return this.toJS()
    }
    spread() {
      const js = {}
      for (const [prop] of Object.entries(schema.properties)) {
        const index = propMap[prop]
        const value = this.#backingArray.get(index)
        if (value === EMPTY) {
          continue
        }
        js[prop] = value
      }
      return js
    }
    diff() {
      return this.#backingArray.diff()
    }
    static _defineProperties() {
      let index = 0
      for (const prop of props) {
        propMap[prop] = index++
        const property = schema.properties[prop]
        if (property.type === 'object') {
          if (property.title) {
            assert(Models[property.title], `Missing: ${property.title}`)
            if (property.title !== 'State') {
              assert(property.properties || property.patternProperties)
            }
            deepIndices.set(propMap[prop], property)
          } else if (property.patternProperties) {
            deepIndices.set(propMap[prop], property)
          }
        } else if (property.type === 'array') {
          deepIndices.set(propMap[prop], property)
        }
        assert.strictEqual(typeof this.prototype[prop], 'undefined', `${prop}`)
        Object.defineProperty(this.prototype, prop, {
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
      Object.freeze(this.prototype)
    }
  }
  SyntheticObject._defineProperties()
  delete SyntheticObject._defineProperties
  const className = schema.title || 'SyntheticObject'
  Object.defineProperty(SyntheticObject, 'name', { value: className })

  return SyntheticObject
}

const deepMerge = (value) => {
  debug(`deepMerge`, value)
  if (value instanceof Base) {
    return value.merge()
  }
  return value
}

const deepValue = (schema, currentValue, nextValue) => {
  if (schema.type === 'array') {
    assert(schema.items)
    if (schema.items.type === 'object') {
      const Class = getClassForSchema(schema.items)
      assert(Class)
      nextValue = nextValue.map((v) => {
        if (!(v instanceof Class)) {
          return new Class(insidersOnly).update(v)
        }
        return v
      })
      return nextValue
    } else {
      // restriction is arbitrary based on what schema features are used
      assert.strictEqual(schema.items.type, 'string')
      // TODO check the string formats are honoured
      assert(nextValue.every((s) => typeof s === 'string'))
      return nextValue
    }
  } else {
    assert.strictEqual(schema.type, 'object')
    if (!schema.properties && !schema.patternProperties && !schema.title) {
      assert.strictEqual(typeof nextValue, 'object')
      return nextValue
    }
    const Class = getClassForSchema(schema)
    assert(Class)
    if (nextValue instanceof Class) {
      return nextValue
    } else if (currentValue === EMPTY) {
      if (schema.title === 'State') {
        // TODO avoid state being a special case
        currentValue = Class.create()
      } else {
        currentValue = new Class(insidersOnly)
      }
    }
    const ret = currentValue.update(nextValue)
    return ret
  }
}

const classMap = new Map()
const getClassForSchema = (schema) => {
  assert.strictEqual(typeof schema, 'object')
  if (classMap.has(schema)) {
    return classMap.get(schema)
  }
  let Class
  if (schema.type === 'object') {
    if (schema.title) {
      Class = Models[schema.title]
      assert(Class, `${schema.title} not found`)
    } else if (schema.patternProperties) {
      Class = patternProperties(schema)
    } else {
      Class = properties(schema)
    }
  } else {
    assert.strictEqual(schema.type, 'array')
    assert(schema.items)
    assert(schema.items.type !== 'array')
    Class = getClassForSchema(schema.items)
  }
  assert(Class, `${schema.title} not found`)
  classMap.set(schema, Class)
  return Class
}
