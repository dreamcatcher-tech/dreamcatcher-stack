import assert from 'assert-fast'
import { Pulse, AsyncTrail } from '../../w008-ipld'
import * as system from '../../w212-system-covenants'
import { wrapReduce } from '../../w010-hooks'
import Debug from 'debug'
const debug = Debug('interblock:engine:services')
const defaultReducer = (request) => {
  debug(`default reducer`, request)
}
export class IsolateContainer {
  #covenant
  static async create(pulse, overloads, timeout) {
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert.strictEqual(typeof overloads, 'object')
    assert(Number.isInteger(timeout))
    const { covenant: covenantString } = pulse.provenance.dmz

    let covenant = { reducer: defaultReducer }
    // have fun: https://github.com/dreamcatcher-tech/dreamcatcher-stack/blob/master/pkg/interblock/src/w006-schemas/IpldSchemas.md#covenant
    if (overloads[covenantString]) {
      covenant = overloads[covenantString]
    } else if (system[covenantString]) {
      covenant = system[covenantString]
    }
    return new IsolateContainer(covenant, timeout)
  }
  constructor(covenant) {
    assert.strictEqual(typeof covenant, 'object')
    // TODO make covenant a Class
    this.#covenant = covenant
  }
  async unload() {
    debug('unload')
    assert(this.#covenant)
    this.#covenant = undefined
  }
  async reduce(trail) {
    assert(trail instanceof AsyncTrail)
    assert(this.#covenant, `Covenant not loaded`)
    debug('reduce', trail.origin.request.type)
    const reducer = this.#covenant.reducer || defaultReducer
    trail = await wrapReduce(trail, reducer)
    return trail
  }
  async effects() {
    // cannot modify the state at all
    // after invocation, can never call reduce again ?
    debug('effects')
  }
}
export class Isolate {
  #overloads = {}
  #overloadPulses = new Map()
  static create() {
    return new Isolate()
  }
  overload(overloads) {
    assert.strictEqual(typeof overloads, 'object')
    // the dev supplied covenants to override blockchained ones
    this.#overloads = overloads
  }
  isCovenant(path) {
    return this.#isOverload(path) || this.#isSystem(path)
  }
  async getCovenantPulse(path) {
    assert(this.isCovenant(path))
    if (this.#isOverload(path)) {
      return await this.#getOverloadPulse(path)
    }
    return await this.#getSystemPulse(path)
  }
  #isSystem(path) {
    if (!path.startsWith('/system:/')) {
      return false
    }
    const systemName = path.substring('/system:/'.length)
    return !!system[systemName]
  }
  async #getSystemPulse(path) {
    assert(this.#isSystem(path))
    const systemName = path.substring('/system:/'.length)
    assert(system[systemName], `unknown system covenant: ${systemName}`)
    if (!this.#overloadPulses.has(path)) {
      const covenant = system[systemName]
      const pulse = await Pulse.createCovenantOverload(covenant)
      this.#overloadPulses.set(path, pulse)
    }
    return this.#overloadPulses.get(path)
  }
  #isOverload(path) {
    return !!this.#overloads[path]
  }
  async #getOverloadPulse(path) {
    assert(this.#isOverload(path))
    if (!this.#overloadPulses.has(path)) {
      const covenant = this.#overloads[path]
      const pulse = await Pulse.createCovenantOverload(covenant)
      this.#overloadPulses.set(path, pulse)
    }
    return this.#overloadPulses.get(path)
  }
  async load(pulse, timeout) {
    debug('load')
    const overloads = this.#overloads
    return await IsolateContainer.create(pulse, overloads, timeout)
  }
}
