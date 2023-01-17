import posix from 'path-browserify'
import assert from 'assert-fast'
import {
  HistoricalPulseLink,
  Config,
  Binary,
  Timestamp,
  Network,
  State,
  Pending,
  Pulse,
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
      pending: Pending.create(),
      covenant: 'unity',
    }
  }
  if (CI) {
    return { ...defaultParams, timestamp: ciTimestamp }
  } else {
    return { ...defaultParams, timestamp: Timestamp.create() }
  }
}
export class Dmz extends IpldStruct {
  #bakedCovenant
  static cidLinks = [
    'config',
    'network',
    'state',
    'pending',
    'approot',
    'binary',
  ]
  static classMap = {
    config: Config,
    timestamp: Timestamp,
    network: Network,
    state: State,
    pending: Pending,
    appRoot: HistoricalPulseLink,
    binary: Binary,
  }
  static create(params = {}, CI = false) {
    assert.strictEqual(typeof params, 'object')
    params = { ...params }
    const defaultParams = getDefaultParams(CI)
    for (const key in params) {
      if (key === 'covenant') {
        assert.strictEqual(typeof key, 'string')
        continue
      }
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
    // TODO verify that the pending buffers map to legit channels
    // TODO find how to not infect everything with async
    // assert(!network.getIo() || config.isPierced)
  }
  getCovenantPath() {
    const { covenant } = this
    assert.strictEqual(typeof covenant, 'string')
    let covenantPath = covenant
    if (!posix.isAbsolute(covenantPath)) {
      // TODO be precise about assumption this is a system covenant
      covenantPath = '/system:/' + covenantPath
    }
    return covenantPath
  }
  bake(covenantPulse) {
    assert(covenantPulse instanceof Pulse)
    assert(!this.#bakedCovenant)
    assert(!covenantPulse.isModified())
    this.#bakedCovenant = covenantPulse
  }
  get bakedCovenant() {
    return this.#bakedCovenant
  }
}
