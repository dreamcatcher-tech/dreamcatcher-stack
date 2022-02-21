import { Block } from 'multiformats/block'
import { CID } from 'multiformats/cid'

/**
 * Rules are:
 *    1. There must be a path from the root CID to every child CID that is
 *       unbroken.  Ie: every CID must have a direct parent which is also a
 *       piece of CID linked data
 */

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
  static getClassFor(key) {
    throw new Error('Not Implemented')
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
  getDiffBlocks(from) {
    throw new Error('Not Implemented')
  }
}
const deepFreeze = (obj) => {
  if (Object.isFrozen(obj)) {
    return
  }
  Object.freeze(obj)

  for (const key in obj) {
    if (obj[key] instanceof Uint8Array) {
      continue
    }
    if (obj instanceof Block && key === 'asBlock') {
      // asBlock is a circular reference
      continue
    }
    if (typeof obj[key] === 'object') {
      deepFreeze(obj[key])
    }
  }
}
