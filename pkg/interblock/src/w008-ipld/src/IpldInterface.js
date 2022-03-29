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
  static links = [] // which keys should be crushed into CIDs
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
  async crush() {
    throw new Error('Not Implemented')
  }
  static uncrush() {
    throw new Error('Not Implemented')
  }
  getDiffBlocks() {
    throw new Error('Not Implemented')
  }
  logDiff() {
    const diffmap = this.getDiffBlocks()
    const log = []
    for (const { cid, value } of diffmap.values()) {
      log.push([cid, value])
    }
    console.dir(log, { depth: Infinity })
  }
}
