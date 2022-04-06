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
  async crush(resolver) {
    if (!this.isModified()) {
      assert(this.#ipldBlock)
      assert(this === this.#crushed)
      if (this !== this.#previous) {
        const next = this.constructor.clone({ ...this })
        next.#previous = next
        next.#crushed = next
        next.#ipldBlock = this.#ipldBlock
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
        crushed[key] = await slice.crush(resolver)
        if (this.isCidLink(key)) {
          dagTree[key] = crushed[key].cid
        } else {
          dagTree[key] = crushed[key]
        }
      } else if (Array.isArray(slice)) {
        const awaits = slice.map((v) => v.crush(resolver))
        const crushes = await Promise.all(awaits)
        crushed[key] = crushes
        dagTree[key] = crushes.map((v) => v.cid)
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
    instance.deepFreeze()
    return instance
  }
  setMap(map) {
    assert.strictEqual(typeof map, 'object')
    return this.constructor.clone({ ...this, ...map })
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
