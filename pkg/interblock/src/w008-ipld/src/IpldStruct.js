import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Block } from 'multiformats/block'
import { encode } from './IpldUtils'
import { IpldInterface } from './IpldInterface'

export class IpldStruct extends IpldInterface {
  #ipldBlock
  #previous
  #crushed
  #isPreCrushed = false
  static clone(map) {
    assert.strictEqual(typeof map, 'object')
    const instance = new this()
    Object.assign(instance, map)
    instance.deepFreeze()
    if (typeof instance.assertLogic === 'function') {
      instance.assertLogic()
    }
    return instance
  }
  #clone() {
    const next = new this.constructor()
    Object.assign(next, this)
    next.#ipldBlock = this.#ipldBlock
    next.#previous = this.#previous
    next.#crushed = this.#crushed
    next.#isPreCrushed = this.#isPreCrushed
    return next
  }
  isModified() {
    return this.#ipldBlock === undefined
  }
  get ipldBlock() {
    if (this.isModified()) {
      throw new Error('Instance must be crushed before block is encoded')
    }
    assert(this.#ipldBlock instanceof Block)
    assert(Object.isFrozen(this.#ipldBlock))
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
  async crush(resolver) {
    if (!this.isModified()) {
      assert(this.#ipldBlock)
      assert(this === this.#crushed)
      if (this !== this.#previous) {
        const next = this.#clone()
        next.#previous = next
        next.#crushed = next
        return next
      }
      return this
    }
    if (this.#isPreCrushed) {
      // throw new Error('TESTING Crush has already been called')
    }
    this.#isPreCrushed = true
    const crushed = new this.constructor()
    Object.assign(crushed, this)
    const dagTree = { ...this }
    for (const key in crushed) {
      const slice = crushed[key]
      if (slice instanceof IpldInterface) {
        await slice.crush(resolver)
        crushed[key] = await slice.crush(resolver)
        if (this.isCidLink(key)) {
          dagTree[key] = crushed[key].cid
        } else {
          dagTree[key] = crushed[key]
        }
      } else if (Array.isArray(slice)) {
        const awaits = slice.map((v) => {
          if (v instanceof IpldInterface) {
            return v.crush(resolver)
          }
          return v
        })
        const crushes = await Promise.all(awaits)
        crushed[key] = crushes
        if (this.isCidLink(key)) {
          dagTree[key] = crushes.map((v) => v.cid)
        } else {
          dagTree[key] = crushes
        }
      }
    }
    crushed.#ipldBlock = await encode(dagTree)
    crushed.#crushed = crushed
    crushed.#previous = this.#crushed
    IpldInterface.deepFreeze(crushed.#ipldBlock)
    crushed.deepFreeze()
    return crushed
  }
  async getDiffBlocks() {
    // diffs since the last time we crushed
    assert(!this.isModified())
    const blocks = new Map()
    const from = this.#previous
    if (from === this) {
      return blocks
    }
    blocks.set(this.ipldBlock.cid.toString(), this.ipldBlock)
    for (const key in this) {
      const thisValue = this[key]
      const fromValue = from && from[key]
      if (thisValue instanceof IpldInterface) {
        assert(fromValue === undefined || fromValue instanceof IpldInterface)
        if (!fromValue || !thisValue.cid.equals(fromValue.cid)) {
          const valueBlocks = await thisValue.getDiffBlocks(fromValue)
          merge(blocks, valueBlocks)
        }
      } else if (Array.isArray(thisValue)) {
        const awaits = thisValue.map(async (v, i) => {
          if (!fromValue || !fromValue[i]) {
            return await v.getDiffBlocks()
          }
          if (!v.cid.equals(fromValue[i].cid)) {
            return await v.getDiffBlocks(fromValue[i])
          }
        })
        const valueBlocks = await Promise.all(awaits)
        valueBlocks.forEach((map) => merge(blocks, map))
      }
    }
    return blocks
  }
  static async uncrush(rootCid, resolver, options) {
    // throw if resolver does not have what we are looking for
    // recursively rebuild everything, from bottom first ?
    assert(rootCid instanceof CID, `rootCid must be a CID, got ${rootCid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)
    const block = await resolver(rootCid)
    // TODO check the schema
    const map = { ...block.value }
    for (const key in map) {
      if (map[key] instanceof CID) {
        const childClass = this.getClassFor(key)
        map[key] = await childClass.uncrush(map[key], resolver, options)
      }
    }
    const instance = new this()
    Object.assign(instance, map)
    instance.#ipldBlock = block
    instance.#crushed = instance
    instance.#previous = instance
    instance.deepFreeze()
    return instance
  }
  setMap(map) {
    assert.strictEqual(typeof map, 'object')
    const inflated = { ...map }
    for (const key in map) {
      if (map[key] === this[key]) {
        delete inflated[key]
        continue
      }
      if (this.constructor.classMap[key]) {
        if (this[key] instanceof IpldStruct) {
          const next = this[key].setMap(map[key])
          assert(next instanceof this.constructor.classMap[key])
          inflated[key] = next
        }
      }
      // TODO handle arrays
    }
    if (Object.keys(inflated).length === 0) {
      return this
    }
    const next = this.#clone()
    next.#ipldBlock = undefined // this is now modified
    Object.assign(next, inflated)
    return next
  }
  set(key, value) {
    if (this[key] === value) {
      return this
    }
    if (this.constructor.getClassFor(key) !== value.constructor) {
      throw new Error(`Cannot set ${key} to ${value.constructor.name}`)
    }
    const schema = this.constructor.schema
    assert.strictEqual(schema.kind, 'struct')
    assert(schema.fields[key])
    // TODO check type of value

    // copy all values over
    // update this key
    // return this
  }
}

const merge = (dst, src) => {
  assert(dst instanceof Map)
  assert(src instanceof Map)
  for (const [key, value] of src) {
    dst.set(key, value)
  }
}