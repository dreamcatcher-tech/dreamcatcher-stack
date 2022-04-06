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

let defaultParams
const getDefaultParams = () => {
  if (!defaultParams) {
    defaultParams = {
      config: Config.create(),
      timestamp: Timestamp.create(),
      network: Network.create(),
      state: State.create(),
      meta: Meta.create(),
    }
  }
  return defaultParams
}
export class Dmz extends IpldStruct {
  static classMap = {
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
  static create(params = {}) {
    assert.strictEqual(typeof params, 'object')
    for (const key in params) {
      assert(this.classMap[key], `key ${key} not mapped to CID class`)
      assert(params[key] instanceof this.classMap[key])
    }
    params = { ...getDefaultParams(), ...params }
    return super.clone(params)
  }
  assertLogic() {
    // TODO if isSideEffectCapable ensure the validators list is singular
    const { network, config } = this
    // TODO verify that the pending buffers map to legit channels
    assert(!network.getIo() || config.isPierced)
  }
}
