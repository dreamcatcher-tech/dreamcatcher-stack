import assert from 'assert-fast'
import { assertNoUndefined } from './classes/State'
import equals from 'fast-deep-equal'
import { schemas } from './schemas/ipldSchemas'
import { CID } from 'multiformats/cid'
import { Block } from 'multiformats/block'
import { BlockFactory } from './CIDFactory'
import { IpldInterface } from './IpldInterface'

export class IpldStruct extends IpldInterface {
  static create(map) {
    const instance = new this()
    Object.assign(instance, map)
    instance.deepFreeze()
    return instance
  }
  #ipldBlock
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

  async crush() {
    if (!this.isModified()) {
      return this
    }
    const crushed = new this.constructor()
    Object.assign(crushed, this)
    const dagTree = { ...this }
    for (const key in crushed) {
      if (crushed[key] instanceof IpldInterface) {
        crushed[key] = await crushed[key].crush()
        dagTree[key] = crushed[key].cid
      }
      if (crushed[key] instanceof Block) {
        // TODO move to use a dedicated Binary class
        dagTree[key] = crushed[key].cid
      }
    }
    crushed.#ipldBlock = await BlockFactory(dagTree)
    IpldInterface.deepFreeze(crushed.#ipldBlock)
    crushed.deepFreeze()
    return crushed
  }

  getDiffBlocks(from) {
    assert(!this.isModified())
    if (from) {
      assert(from instanceof this.constructor)
      assert(!from.isModified())
    }
    if (this === from) {
      return []
    }
    if (from && this.cid.equals(from.cid)) {
      return []
    }
    const blocks = [this.ipldBlock]
    for (const key in this) {
      const thisValue = this[key]
      const fromValue = from && from[key]
      if (thisValue instanceof IpldInterface) {
        assert(fromValue === undefined || fromValue instanceof IpldInterface)
        if (!fromValue || !thisValue.cid.equals(fromValue.cid)) {
          const valueBlocks = thisValue.getDiffBlocks(fromValue)
          blocks.push(...valueBlocks)
        }
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
