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
  ciTimestamp = Timestamp.createCI()
}
export class Dmz extends IpldStruct {
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
    // TODO find how to not infect everything with async
    // assert(!network.getIo() || config.isPierced)
  }
  async addChild(path, params = {}) {
    assert(typeof path === 'string')
    assert(path)
    assert(!path.includes('/'))
    assert(typeof params === 'object')
    if (await this.network.children.has(path)) {
      throw new Error(`child exists: ${path}`)
    }
    const { timestamp } = this

    const dmz = Dmz.create({ ...params, timestamp })
    const provenance = Provenance.createGenesis(dmz)
    const genesis = await Pulse.create(provenance).crush()
    const address = genesis.getAddress()
    const network = await this.network.txGenesis(path, address, params)
    return this.setMap({ network })
  }
}
