import assert from 'assert-fast'
import Immutable from 'immutable'
import { sha256 } from '@noble/hashes/lib/sha256.js'
import { bytesToHex } from '@noble/hashes/lib/utils'
import Debug from 'debug'
const debug = Debug('interblock:classes:MerkleArray')
const operations = ['add', 'remove', 'replace']

export class MerkleArray {
  /**
   * Manages a merkle tree to get rapid hash results from large arrays.
   * Compacts the array at the end, if needed, to change the hash tree
   * as little as possible.
   * Network is the only slice that uses compaction, all else only ever
   * increases.
   * Fast enough to be used during the blocking process.
   * Tracks diffs so that only changes need be written to the DB.
   */
  #base = Immutable.List()
  #adds = Immutable.List()
  #puts = Immutable.Map()
  #dels = Immutable.OrderedSet()
  #merkle = Immutable.List()
  #flatTree = false
  #noDeletions = false
  #dirty = Immutable.Set()
  constructor(base, { flatTree = false, noDeletions = false } = {}) {
    this.#flatTree = flatTree
    this.#noDeletions = noDeletions
    if (base) {
      assert(Array.isArray(base))
      assert(base.every((v) => v !== undefined))
      return this.addBulk(base).merge()
    }
  }
  #clone() {
    const clone = new MerkleArray()
    clone.#base = this.#base
    clone.#adds = this.#adds
    clone.#puts = this.#puts
    clone.#dels = this.#dels
    clone.#merkle = this.#merkle
    clone.#flatTree = this.#flatTree
    clone.#noDeletions = this.#noDeletions
    clone.#dirty = this.#dirty
    return clone
  }
  get size() {
    return this.#base.size + this.#adds.size
  }
  addBulk(values) {
    // spread operator causes max callstack exceeded above ~100k elements
    assert(Array.isArray(values))
    const next = this.#clone()
    next.#adds = next.#adds.concat(values)
    return next
  }
  add(...values) {
    assert(Array.isArray(values))
    const next = this.#clone()
    next.#adds = next.#adds.concat(values)
    return next
  }
  remove(index) {
    assert(!this.#noDeletions, 'No deletions')
    assert(index < this.size)
    assert(index >= 0)
    assert(!this.#dels.has(index))
    const next = this.#clone()
    next.#dels = next.#dels.add(index).sort()
    next.#puts = next.#puts.delete(index)
    return next
  }
  put(index, value) {
    assert(index < this.size)
    assert(index >= 0)
    assert(value !== undefined)
    const next = this.#clone()
    if (next.#dels.has(index)) {
      next.#dels = next.#dels.delete(index)
    }
    if (index >= this.#base.size) {
      const addIndex = index - this.#base.size
      next.#adds = next.#adds.set(addIndex, value)
    } else {
      next.#puts = next.#puts.set(index, value)
    }
    return next
  }
  get(index) {
    assert(index < this.size)
    assert(index >= 0)
    if (this.#dels.size && this.#dels.has(index)) {
      return
    }
    if (index >= this.#base.size) {
      const addIndex = index - this.#base.size
      if (this.#adds.has(addIndex)) {
        return this.#adds.get(addIndex)
      }
    } else {
      if (this.#puts.has(index)) {
        return this.#puts.get(index)
      }
      return this.#base.get(index)
    }
  }
  getCompactPlan() {
    const plan = []
    const nextBase = this.#base.concat(this.#adds)
    let cursor = nextBase.size
    for (const index of this.#dels) {
      while (cursor > index) {
        cursor--
        if (this.#dels.has(cursor)) {
          continue
        }
        plan.push([index, cursor])
        break
      }
      if (index >= cursor) {
        break
      }
    }
    return plan
  }
  #isCompacted() {
    if (this.#noDeletions) {
      return true
    }
    if (this.#dels.size && this.#adds.size) {
      return false
    }
    const length = this.size
    let cursor = length - this.#dels.size
    for (const index of this.#dels) {
      if (index !== cursor) {
        return false
      }
      cursor++
    }
    if (cursor !== length) {
      return false
    }
    return true
  }
  compact() {
    if (this.#isCompacted()) {
      return this
    }
    let next = this.#clone()
    const plan = next.getCompactPlan()
    for (const [to, from] of plan) {
      const value = next.get(from)
      // TODO allow withMutations somehow
      next = next.remove(from)
      next = next.put(to, value)
    }
    // TODO split dels into overs and unders to simplify compaction
    const isOverLength = next.#dels.last() >= next.#base.size
    if (isOverLength) {
      const isUnderLength = next.#dels.first() < next.#base.size
      if (isUnderLength) {
        let firstOverIndex = -1
        for (const index of next.#dels) {
          firstOverIndex++
          if (index === next.#base.size) {
            break
          }
        }
        assert(Number.isInteger(firstOverIndex))
        next.#dels = next.#dels.slice(0, firstOverIndex)
        next.#adds = next.#adds.clear()
      } else {
        const firstAddDeletion = next.#dels.first()
        assert(Number.isInteger(firstAddDeletion))
        const trimIndex = firstAddDeletion - next.#base.size
        assert(trimIndex >= 0)
        next.#adds = next.#adds.slice(0, trimIndex)
        next.#dels = next.#dels.clear()
      }
    }
    assert(next.#isCompacted())
    return next
  }
  #isMerged() {
    return !this.#adds.size && !this.#puts.size && !this.#dels.size
  }
  merge() {
    assert(this.#isCompacted(), 'cannot merge when not compacted')
    assert(!this.#dels.size || !this.#adds.size, 'cannot both add and delete')
    if (this.#isMerged()) {
      return this
    }
    const next = this.#clone()
    const dirty = []
    next.#base = next.#base.withMutations((base) => {
      const nextSize = next.#base.size + next.#adds.size - next.#dels.size
      for (let i = base.size; i < nextSize; i++) {
        dirty.push(i)
      }
      debug(`nextSize`, nextSize)
      base = base.concat(next.#adds)
      debug(`after concat: `, base.size)
      for (const [putIndex, value] of next.#puts.entries()) {
        assert(putIndex < base.size - next.#dels.size)
        base = base.set(putIndex, value)
        if (putIndex < next.#base.size) {
          dirty.push(putIndex)
        }
      }
      base = base.setSize(base.size - next.#dels.size)
      debug(`final size:`, base.size)
    })

    next.#dirty = next.#dirty.subtract(next.#dels)
    next.#dirty = next.#dirty.concat(dirty)
    next.#adds = next.#adds.clear()
    next.#puts = next.#puts.clear()
    next.#dels = next.#dels.clear()
    return next
  }
  #updateMerkleTree() {
    assert(this.#isClean(), 'cannot hash while dirty')
    assert(Immutable.Set.isSet(this.#dirty))

    if (!this.#base.size) {
      this.#merkle = this.#merkle.clear()
      this.#dirty = this.#dirty.clear()
    }
    if (!this.#dirty.size) {
      return
    }
    if (this.#flatTree) {
      const hasher = sha256.create()
      for (const element of this.#base) {
        if (typeof element === 'symbol') {
          continue
        }
        if (typeof element.hashRaw === 'function') {
          const hash = element.hashRaw()
          assert(hash instanceof Uint8Array)
          hasher.update(hash)
        } else if (Array.isArray(element)) {
          // only arrays in schemas are all of the same type
          const array = element.map((e) => {
            if (typeof e.hashRaw === 'function') {
              return e.hashRaw()
            }
            return e
          })
          const string = JSON.stringify(array)
          hasher.update(Uint8Array.from(string))
        } else {
          const string = JSON.stringify(element)
          hasher.update(Uint8Array.from(string))
        }
      }
      const hash = hasher.digest()
      this.#merkle = this.#merkle.set(0, Immutable.List([hash]))
    } else {
      this.#merkle = this.#merkle.withMutations((merkle) => {
        let lowerLayer = this.#base
        let layerIndex = 0
        let dirty = this.#dirty
          .sort()
          .map((i) => Math.floor(i / 2))
          .toArray()
        let layerSize = Math.ceil(this.#base.size / 2)
        do {
          let layer = merkle.get(layerIndex, Immutable.List())
          let nextDirty = []
          if (layer.size > layerSize) {
            layer = layer.setSize(layerSize)
          }
          dirty.forEach((dirtyIndex, index) => {
            if (dirty[index + 1] === dirtyIndex) {
              // lookahead avoids using a 4x slower Set to deduplicate
              return
            }
            let left = lowerLayer.get(dirtyIndex * 2)
            let right = lowerLayer.get(dirtyIndex * 2 + 1)
            if (layerIndex === 0) {
              left = MerkleArray.#hash(left)
              if (typeof right !== 'undefined') {
                right = MerkleArray.#hash(right)
              }
            }
            if (right === undefined) {
              right = Uint8Array.from([])
            }
            const mergedArray = new Uint8Array(left.length + right.length)
            mergedArray.set(left)
            mergedArray.set(right, left.length)
            const hash = MerkleArray.#hash(mergedArray)
            layer = layer.set(dirtyIndex, hash)
            nextDirty.push(Math.floor(dirtyIndex / 2))
          })
          merkle.set(layerIndex, layer)
          lowerLayer = layer
          layerIndex++
          dirty = nextDirty
          layerSize = Math.ceil(layerSize / 2)
        } while (lowerLayer.size > 1)
        merkle.setSize(layerIndex) // knock the top off the christmas tree
      })
    }
    this.#dirty = this.#dirty.clear()
  }
  static #hash(value) {
    if (value instanceof Uint8Array) {
      return sha256(value)
    }
    if (typeof value.getHash === 'function') {
      const hash = value.getHash()
      if (hash instanceof Uint8Array) {
        return hash
      }
      return sha256(hash)
    }
    if (typeof value.serialize === 'function') {
      return sha256(value.serialize())
    }
    return sha256(value.toString())
  }
  hashString() {
    return bytesToHex(this.hash())
  }
  hash() {
    assert(this.#isClean(), 'cannot hash while dirty')
    if (this.#dirty.size) {
      this.#updateMerkleTree()
    }
    const topLayer = this.#merkle.last()
    assert.strictEqual(topLayer.size, 1)
    return topLayer.get(0)
  }
  proof(index) {
    assert(this.#isMerged(), 'can only proof after merge')
    assert(index < this.#base.size)
    assert(index >= 0)
    assert(this.#base.get(index))
    // TODO generate the merkle proof
  }
  diff() {
    assert(this.#isCompacted())
    const ops = []
    let index = this.#base.size
    for (const value of this.#adds) {
      ops.push({ op: 'add', path: [index], value })
      index++
    }
    for (const delIndex of this.#dels) {
      ops.push({ op: 'remove', path: [delIndex] })
    }
    for (const [putIndex, value] of this.#puts) {
      ops.push({ op: 'replace', path: [putIndex], value })
    }
    return ops
  }
  #isClean() {
    return this.#isCompacted() && this.#isMerged()
  }
  patch(opsList) {
    assert(Array.isArray(opsList))
    assert(this.#isClean(), 'cannot patch when dirty')
    let next = this.#clone()
    for (const { op, path, value } of opsList) {
      assert(operations.includes(op))
      assert(Array.isArray(path))
      assert.strictEqual(path.length, 1)
      switch (op) {
        case 'add': {
          assert(value !== undefined)
          assert.strictEqual(path[0], next.size)
          next = next.add(value)
          break
        }
        case 'remove': {
          assert.strictEqual(value, undefined)
          next = next.remove(path[0])
          break
        }
        case 'replace': {
          assert(value !== undefined)
          next = next.put(path[0], value)
          break
        }
      }
    }
    return next.compact().merge()
  }
  toArray() {
    // TODO turn clean check back on
    // assert(this.#isClean(), 'cannot serialize when dirty')
    return this.compact().merge().#base.toArray()
  }
  equals(other) {
    assert(this.#isClean(), 'cannot compare this while dirty')
    assert(other.#isClean(), 'cannot compare other while dirty')
    if (other instanceof MerkleArray) {
      return this.#base.equals(other.#base)
    }
    return false
  }

  _dumpInternals() {
    return {
      base: this.#base.toArray(),
      adds: this.#adds.toArray(),
      puts: this.#puts.toObject(),
      dels: this.#dels.toArray(),
      merkle: this.#merkle.toArray().map((l) => l.toArray()),
    }
  }
}
