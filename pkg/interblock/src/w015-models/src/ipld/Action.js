import assert from 'assert-fast'
import { assertNoUndefined } from './utils'
import equals from 'fast-deep-equal'
import { IpldStruct } from './IpldStruct'
import { RawBinary } from '.'
import { schemas } from '../schemas/ipldSchemas'

const classMap = { binary: RawBinary }
export class Action extends IpldStruct {
  static create(action, payload = {}, binary) {
    if (typeof action === 'undefined') {
      throw new Error(`Actions cannot be undefined`)
    }
    if (typeof action === 'string') {
      action = { type: action, payload }
    }
    if (!action.payload) {
      action = { ...action, payload: {} }
    }
    assertNoUndefined(action.payload)
    const s = JSON.stringify(action.payload, null, 2)
    const cloned = JSON.parse(s)
    assert(equals(action.payload, cloned), `payload not POJO ${s}`)
    if (binary) {
      action = { ...action, binary }
    }
    if (action.binary) {
      assert(binary instanceof RawBinary)
    }
    return super.create(action)
  }
  static getClassFor(key) {
    assert(classMap[key], `key not mapped to CID class`)
    return classMap[key]
  }
  static get schema() {
    return schemas.types.Action
  }
}
