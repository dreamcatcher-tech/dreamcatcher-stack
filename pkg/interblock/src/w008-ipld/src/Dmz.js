import assert from 'assert-fast'
import {
  Provenance,
  Pulse,
  PulseLink,
  Config,
  Binary,
  Timestamp,
  Network,
  State,
  Meta,
  Pending,
} from '.'
import { IpldStruct } from './IpldStruct'

const ciTimestamp = Timestamp.createCI()
let defaultParams
const getDefaultParams = (CI = false) => {
  if (!defaultParams) {
    defaultParams = {
      config: Config.create(),
      network: Network.create(),
      state: State.create(),
      meta: Meta.create(),
    }
  }
  if (CI) {
    return { ...defaultParams, timestamp: ciTimestamp }
  } else {
    return { ...defaultParams, timestamp: Timestamp.create() }
  }
}
export class Dmz extends IpldStruct {
  static cidLinks = [
    'config',
    'network',
    'state',
    'meta',
    'pending',
    'approot',
    'binary',
  ]
  static classMap = {
    config: Config,
    timestamp: Timestamp,
    network: Network,
    state: State,
    meta: Meta,
    pending: Pending,
    approot: PulseLink,
    binary: Binary,
  }
  static create(params = {}, CI = false) {
    assert.strictEqual(typeof params, 'object')
    params = { ...params }
    const defaultParams = getDefaultParams(CI)
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
    // TODO find how to not infect everything with async
    // assert(!network.getIo() || config.isPierced)
  }
}
