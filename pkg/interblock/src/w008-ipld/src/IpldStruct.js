import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Block } from 'multiformats/block'
import { encode } from './IpldUtils'
import { IpldInterface } from './IpldInterface'
import equals from 'fast-deep-equal'

export class IpldStruct extends IpldInterface {
  #ipldBlock
  #ipldInitial
  #previous
  #crushed
  clone() {
    const next = new this.constructor()
    Object.assign(next, this)
    next.#ipldBlock = this.#ipldBlock
    next.#ipldInitial = this.#ipldInitial
    next.#previous = this.#previous
    next.#crushed = this.#crushed
    return next
  }
  isModified() {
    return this.#ipldBlock === undefined && this.#ipldInitial === undefined
  }
  get ipldBlock() {
    if (this.isModified()) {
      throw new Error('Instance must be crushed before block is encoded')
    }
    assert(this.#ipldBlock instanceof Block)
    return this.#ipldBlock
  }
  get crushedSize() {
    return this.ipldBlock.bytes.length
  }
  get cid() {
    const { cid } = this.ipldBlock
    return cid
  }
  get currentCrush() {
    return this.#crushed
  }
  async crushToCid(resolver) {
    const isCidLink = true
    return this.crush(resolver, isCidLink)
  }
  async crush(resolver, isCidLink) {
    if (!this.#cachedCrush) {
      this.#cachedCrush = await this.#crush(resolver, isCidLink)
    }
    return this.#cachedCrush
  }
  #cachedCrush
  async #crush(resolver, isCidLink) {
    if (!this.isModified()) {
      assert(this.#ipldBlock || this.#ipldInitial)
      assert(this === this.#crushed)
      if (this !== this.#previous) {
        const next = this.clone()
        next.#previous = next
        next.#crushed = next
        return next
      }
      return this
    }
    const crushed = new this.constructor()
    Object.assign(crushed, this)
    const dagTree = {}
    const awaits = Object.keys(crushed).map(async (key) => {
      const isChildCidLink = this.constructor.isCidLink(key)
      const slice = crushed[key]
      if (slice instanceof IpldInterface) {
        crushed[key] = await slice.crush(resolver, isChildCidLink)
        if (isChildCidLink) {
          dagTree[key] = crushed[key].cid
        } else {
          dagTree[key] = crushed[key].#ipldInitial
        }
      } else if (Array.isArray(slice)) {
        const awaits = slice.map((v) => {
          if (v instanceof IpldInterface) {
            return v.crush(resolver, isChildCidLink)
          }
          return v
        })
        crushed[key] = await Promise.all(awaits)
        if (isChildCidLink) {
          dagTree[key] = crushed[key].map((v) => v.cid)
        } else {
          dagTree[key] = crushed[key]
        }
      } else {
        assert(!isChildCidLink)
        dagTree[key] = crushed[key]
      }
    })
    await Promise.all(awaits)
    assert.strictEqual(Object.keys(dagTree).length, Object.keys(crushed).length)
    if (isCidLink) {
      crushed.#ipldBlock = await encode(dagTree)
    } else {
      crushed.#ipldInitial = dagTree
    }
    // TODO run the schema check here on dagTree
    crushed.#crushed = crushed
    crushed.#previous = this.#crushed
    return crushed
  }
  getDiffBlocks() {
    // diffs since the last time we crushed
    assert(!this.isModified())
    const blockMap = new Map()
    const previous = this.#previous
    if (previous === this) {
      return blockMap
    }
    if (this.#ipldBlock) {
      blockMap.set(this.ipldBlock.cid.toString(), this.ipldBlock)
    }
    for (const key in this) {
      const thisVal = this[key]
      const prevVal = previous && previous[key]
      if (Array.isArray(thisVal)) {
        thisVal.forEach((v, i) => {
          if (v instanceof IpldInterface) {
            if (!prevVal || !prevVal[i]) {
              merge(blockMap, v.getDiffBlocks())
            } else if (!v.cid.equals(prevVal[i].cid)) {
              merge(blockMap, v.getDiffBlocks(prevVal[i]))
            }
          }
        })
      } else if (thisVal instanceof IpldInterface) {
        assert(prevVal === undefined || prevVal instanceof IpldInterface)
        if (this.constructor.isCidLink(key)) {
          if (prevVal && thisVal.cid.equals(prevVal.cid)) {
            continue
          }
        } else {
          if (prevVal && equals(prevVal.#ipldInitial, thisVal.#ipldInitial)) {
            continue
          }
        }
        const valueBlocks = thisVal.getDiffBlocks()
        merge(blockMap, valueBlocks)
      }
    }
    return blockMap
  }
  static async uncrush(initial, resolver, options) {
    assert(typeof resolver === 'function', `resolver must be a function`)
    let block
    if (initial instanceof CID) {
      block = await resolver(initial)
      assert(block instanceof Block, `not instance of Block`)
      // TODO check the schema
      initial = { ...block.value }
    } else {
      assert.strictEqual(typeof initial, 'object')
      initial = { ...initial }
    }

    const instance = new this()
    const uncrushKey = async (key) => {
      const value = initial[key]
      const isChildCidLink = this.isCidLink(key)
      if (value instanceof CID) {
        assert(isChildCidLink)
        const childClass = this.getClassFor(key)
        instance[key] = await childClass.uncrush(value, resolver, options)
      } else if (Array.isArray(value)) {
        const awaits = value.map((v) => {
          if (this.classMap[key]) {
            return this.classMap[key].uncrush(v, resolver, options)
          }
          return v
        })
        instance[key] = await Promise.all(awaits)
      } else if (this.classMap[key]) {
        instance[key] = await this.classMap[key].uncrush(value, resolver)
      } else {
        instance[key] = value
      }
    }
    const awaits = [] // parallelize bitswap network requests
    for (const key in initial) {
      awaits.push(uncrushKey(key))
    }
    await Promise.all(awaits)

    const keyCount = Object.keys(initial).length
    assert.strictEqual(Object.keys(instance).length, keyCount)
    if (block) {
      instance.#ipldBlock = block
    } else {
      instance.#ipldInitial = initial
    }
    instance.#crushed = instance
    instance.#previous = instance
    if (typeof instance.assertLogic === 'function') {
      instance.assertLogic()
    }
    // TODO run the schema check here
    // instance.constructor.name //?
    return instance
  }
  setMap(map) {
    assert.strictEqual(typeof map, 'object')
    const inflated = { ...map }
    for (const key in map) {
      assert(map[key] !== undefined, `${key} is undefined`)
      assert(typeof map[key].then !== 'function', `${key} is a promise`)
      if (map[key] === this[key]) {
        delete inflated[key]
        continue
      }
      if (this.constructor.classMap[key]) {
        if (this[key] instanceof IpldStruct) {
          let next = map[key]
          if (!(next instanceof IpldStruct)) {
            next = this[key].setMap(map[key])
          }
          assert(next instanceof this.constructor.classMap[key], key)
          inflated[key] = next
        }
      }
      // TODO handle arrays
    }
    if (Object.keys(inflated).length === 0) {
      return this
    }
    const next = this.clone()
    next.#setModified()
    Object.assign(next, inflated)
    return next
  }
  delete(key) {
    assert.strictEqual(typeof key, 'string')
    assert(key)
    if (this[key] === undefined) {
      return this
    }
    const next = this.clone()
    delete next[key]
    next.#setModified()
    return next
  }
  #setModified() {
    this.#ipldBlock = undefined
    this.#ipldInitial = undefined
  }
}

const merge = (dst, src) => {
  assert(dst instanceof Map)
  assert(src instanceof Map)
  for (const [key, value] of src) {
    dst.set(key, value)
  }
}
