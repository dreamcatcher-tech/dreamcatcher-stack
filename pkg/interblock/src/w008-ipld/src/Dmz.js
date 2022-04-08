import assert from 'assert-fast'
import {
  PulseLink,
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
  if (ciTimestamp) {
    return { ...defaultParams, timestamp: ciTimestamp }
  }
  return defaultParams
}
let ciTimestamp
export const setCiTimestamp = () => {
  ciTimestamp = Timestamp.create(new Date('2022-04-07T04:39:08.511Z'))
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
    approot: PulseLink,
    binary: Binary,
  }
  static create(params = {}) {
    assert.strictEqual(typeof params, 'object')
    params = { ...params }
    const defaultParams = getDefaultParams()
    for (const key in params) {
      assert(this.classMap[key], `key ${key} not mapped to CID class`)
      const isInstanceOf = params[key] instanceof this.classMap[key]
      if (!isInstanceOf) {
        params[key] = defaultParams[key].setMap(params[key])
      }
    }
    params = { ...defaultParams, ...params }
    return super.clone(params)
  }
  assertLogic() {
    // TODO if isSideEffectCapable ensure the validators list is singular
    const { network, config } = this
    // TODO verify that the pending buffers map to legit channels
    assert(!network.getIo() || config.isPierced)
  }
}
