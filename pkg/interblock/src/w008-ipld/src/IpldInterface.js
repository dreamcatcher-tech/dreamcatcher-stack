import assert from 'assert-fast'
import { deepFreeze } from './utils'

export class IpldInterface {
  get schema() {
    throw new Error('Not Implemented')
  }
  deepFreeze() {
    deepFreeze(this)
  }
  static deepFreeze(obj) {
    deepFreeze(obj)
  }
  isModified() {
    throw new Error('Not Implemented')
  }
  static cidLinks // array of which keys should be crushed into CIDs
  isCidLink(key) {
    assert(typeof key === 'string')
    assert(key)
    if (this.constructor.cidLinks) {
      assert(Array.isArray(this.constructor.cidLinks))
      return this.constructor.cidLinks.includes(key)
    } else {
      return !!this.constructor.classMap[key]
    }
  }
  static classMap = {} // keys to Class mappings
  static getClassFor(key) {
    assert(this.classMap[key], `key ${key} not mapped to class`)
    return this.classMap[key]
  }
  get ipldBlock() {
    throw new Error('Not Implemented')
  }
  get crushedSize() {
    throw new Error('Not Implemented')
  }
  get cid() {
    if (this.isModified()) {
      throw new Error('Instance must be crushed before block is encoded')
    }
    return this.ipldBlock.cid
  }
  async crush(resolver) {
    throw new Error('Not Implemented')
  }
  static uncrush() {
    throw new Error('Not Implemented')
  }
  getDiffBlocks() {
    throw new Error('Not Implemented')
  }
  async logDiff() {
    const diffmap = await this.getDiffBlocks()
    const log = []
    for (const { cid, value } of diffmap.values()) {
      log.push([cid, value])
    }
    console.dir(log, { depth: Infinity })
  }
}