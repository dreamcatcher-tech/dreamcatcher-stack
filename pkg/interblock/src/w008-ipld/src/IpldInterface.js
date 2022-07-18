import assert from 'assert-fast'

export class IpldInterface {
  get schema() {
    throw new Error('Not Implemented')
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
  static defaultClass
  static classMap = {} // keys to Class mappings
  static getClassFor(key) {
    if (!this.defaultClass) {
      assert(this.classMap[key], `key ${key} not mapped to class`)
    }
    return this.classMap[key] || this.defaultClass
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
    const diffmap = this.getDiffBlocks()
    const log = {}
    for (const { cid, value } of diffmap.values()) {
      log[cid.toString().substring(0, 13)] = value
    }
    console.dir(log, { depth: Infinity })
  }
  dir() {
    console.dir(this, { depth: Infinity })
  }
}
