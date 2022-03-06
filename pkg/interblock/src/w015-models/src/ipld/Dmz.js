import assert from 'assert-fast'
import {
  Pulse,
  Validators,
  Config,
  Binary,
  Timestamp,
  Network,
  State,
  Meta,
  Pending,
} from '.'
import { IpldStruct } from './IpldStruct'

// const defaultParams = {
//   config: Config.create(),
//   timestamp: Timestamp.create(),
//   network: Network.create(),
//   state: State.create(),
//   meta: Meta.create(),
// }
const classMap = {
  validators: Validators,
  config: Config,
  timestamp: Timestamp,
  network: Network,
  state: State,
  meta: Meta,
  pending: Pending,
  approot: Pulse,
  binary: Binary,
}
export class Dmz extends IpldStruct {
  static create(params = {}) {
    assert.strictEqual(typeof params, 'object')
    for (const key in params) {
      assert(classMap[key], `key ${key} not mapped to CID class`)
      assert(params[key] instanceof classMap[key])
    }
    params = { ...defaultParams, ...params }
    return super.create(params)
  }
  static getClassFor(key) {
    assert(classMap[key], `key not mapped to CID class`)
    return classMap[key]
  }
  assertLogic() {
    // TODO if isSideEffectCapable ensure the validators list is singular
    const { network, config } = this
    // TODO verify that the pending buffers map to legit channels
    assert(!network.has('.@@io') || config.isPierced)
  }
}
