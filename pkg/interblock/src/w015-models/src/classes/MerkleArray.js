import assert from 'assert-fast'
import Immutable from 'immutable'
import { sha256 } from '@noble/hashes/lib/sha256.js'
import { bytesToHex } from '@noble/hashes/lib/utils'

export class MerkleArray {
  /**
   * Manages a merkle tree to get rapid hash results from large arrays
   * Compacts the array at the end, if needed.
   * Only network has a compacting array.
   */
  #base = Immutable.List()
  #adds = Immutable.List()
  #puts = Immutable.Map()
  #dels = Immutable.OrderedSet()
  #merkle = Immutable.List() // will be a list of lists, one for each layer
  constructor(base) {
    if (base) {
      assert(Array.isArray(base))
      return this.pushBulk(base).merge()
    }
  }
  #clone() {
    const clone = new MerkleArray()
    clone.#base = this.#base
    clone.#adds = this.#adds
    clone.#puts = this.#puts
    clone.#dels = this.#dels
    clone.#merkle = this.#merkle
    return clone
  }
  #length() {
    return this.#base.size + this.#adds.size
  }
  pushBulk(values) {
    // spread operator causes max callstack exceeded above ~100k elements
    assert(Array.isArray(values))
    const next = this.#clone()
    next.#adds = next.#adds.concat(values)
    return next
  }
  push(...values) {
    assert(Array.isArray(values))
    const next = this.#clone()
    next.#adds = next.#adds.concat(values)
    return next
  }
  del(index) {
    assert(index < this.#length())
    assert(index >= 0)
    assert(!this.#dels.has(index))
    const next = this.#clone()
    next.#dels = next.#dels.add(index).sort()
    next.#puts = next.#puts.delete(index)
    return next
  }
  update(index, value) {
    assert(index < this.#length())
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
    assert(index < this.#length())
    assert(index >= 0)
    if (this.#dels.has(index)) {
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
    // return an array of index pairs [current, next]
    // use this to update the luts
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
    if (this.#dels.size && this.#adds.size) {
      return false
    }
    const length = this.#length()
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
      next = next.del(from)
      next = next.update(to, value)
    }
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
      for (let i = base.size; i < base.size + next.#adds.size; i++) {
        dirty.push(i)
      }
      base = base.concat(next.#adds)
      for (const [putIndex, value] of next.#puts.entries()) {
        assert(putIndex < base.size - next.#dels.size)
        base = base.set(putIndex, value)
        if (putIndex < next.#base.size) {
          dirty.push(putIndex)
        }
      }
      base = base.setSize(base.size - next.#dels.size)
    })
    next.#dels = next.#dels.clear()
    next.#puts = next.#puts.clear()
    next.#adds = next.#adds.clear()
    return next.#updateMerkleTree(dirty)
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
  // static #
  #updateMerkleTree(dirtyUnsorted) {
    assert(this.#isClean(), 'cannot hash while dirty')
    assert(Array.isArray(dirtyUnsorted))

    const next = this.#clone()
    if (!next.#base.size) {
      next.#merkle = next.#merkle.clear()
      return next
    }

    next.#merkle = next.#merkle.withMutations((merkle) => {
      let lowerLayer = next.#base
      let layerIndex = 0
      let dirty = dirtyUnsorted
        .sort((a, b) => a - b)
        .map((i) => Math.floor(i / 2))
      let layerSize = Math.ceil(next.#base.size / 2)
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
    return next
  }
  hash() {
    assert(this.#isClean(), 'cannot hash while dirty')
    const topLayer = this.#merkle.last()
    assert.strictEqual(topLayer.size, 1)
    return bytesToHex(topLayer.get(0))
  }
  proof(index) {
    assert(this.#isMerged(), 'can only proof after merge')
    assert(index < this.#base.size)
    assert(index >= 0)
    assert(this.#base.get(index))
    // generate the merkle proof
  }
  diff() {
    // create a patch list that can be applied to #base
    assert(this.#isClean())
  }
  #isClean() {
    return this.#isCompacted() && this.#isMerged()
  }
  patch(opsList) {
    // take a list of operations, and apply them to this object
    // return a new object that is already compacted
    assert(this.#isClean(), 'cannot patch when dirty')
  }
  serialize() {
    assert(this.#isClean(), 'cannot serialize when dirty')
    return JSON.stringify(this.#base.toArray())
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
