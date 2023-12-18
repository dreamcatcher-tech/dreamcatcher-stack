import assert from 'assert-fast'
import { Pulse, AsyncTrail, Request } from '../../w008-ipld/index.mjs'
import * as system from '../../w212-system-covenants'
import { wrapReduce, wrapReduceEffects } from '../../w010-hooks'
import Debug from 'debug'
const debug = Debug('interblock:engine:Isolate')
const defaultReducer = (request) => {
  debug(`default reducer`, request)
}
class IsolateContainer {
  #covenant
  #isEffects = false
  #whisper
  #timeout
  static async create(pulse, overloads, whisper, timeout) {
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert.strictEqual(typeof overloads, 'object')
    assert(Number.isInteger(timeout))
    if (whisper) {
      assert(Array.isArray(whisper))
      assert(!whisper.length, `whisper already has ${whisper.length} entries`)
    }
    const { covenant: covenantString } = pulse.provenance.dmz

    let covenant = { reducer: defaultReducer }
    // have fun: https://github.com/dreamcatcher-tech/dreamcatcher-stack/blob/master/pkg/interblock/src/w006-schemas/IpldSchemas.md#covenant
    if (overloads[covenantString]) {
      covenant = overloads[covenantString]
    } else if (system[covenantString]) {
      covenant = system[covenantString]
    }
    const container = new IsolateContainer(covenant)
    // TODO use full check for if we are effects capable
    container.#isEffects = pulse.getConfig().isPierced
    if (container.#isEffects) {
      assert(whisper, `whisper is required for effects`)
    }
    container.#whisper = whisper
    container.#timeout = timeout
    return container
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
    const timeout = this.#timeout
    const whisper = this.#whisper
    if (this.#isEffects) {
      trail = await wrapReduceEffects(trail, reducer, whisper, timeout)
    } else {
      trail = await wrapReduce(trail, reducer, timeout)
    }
    return trail
  }
}
export class Isolate {
  #overloads = {}
  #overloadPulses = new Map()
  #whispers = new Map() // chainId -> function[]

  static create() {
    return new Isolate()
  }
  static isContainer(container) {
    return container instanceof IsolateContainer
  }
  overload(overloads) {
    // the dev supplied covenants to override blockchained ones
    this.#overloads = Isolate.extractOverloads(overloads)
    return this.#overloads
  }
  static extractOverloads(overloads, pathAccumulator = '') {
    assert.strictEqual(typeof overloads, 'object')
    const nextOverloads = {}
    for (const path in overloads) {
      const covenant = overloads[path]
      // TODO assert matches covenant schema
      assert.strictEqual(typeof covenant, 'object')
      const { covenants } = covenant
      if (covenants) {
        const pathPrefix = pathAccumulator + path + '/'
        const nestedOverloads = Isolate.extractOverloads(covenants, pathPrefix)
        Object.assign(nextOverloads, nestedOverloads)
      }
      nextOverloads[pathAccumulator + path] = covenant
    }
    return nextOverloads
  }
  isCovenant(path) {
    return this.#isOverload(path) || this.#isSystem(path)
  }
  isRelativeCovenant(path) {
    return path.startsWith('#/')
  }
  async getCovenantPulse(path) {
    if (this.#isOverload(path)) {
      return await this.#getOverloadPulse(path)
    }
    assert(this.isCovenant(path))
    return await this.#getSystemPulse(path)
  }
  #isSystem(path) {
    if (!path.startsWith('/system:/')) {
      return false
    }
    const systemName = desystemize(path)
    return !!system[systemName]
  }
  async #getSystemPulse(path) {
    assert(this.#isSystem(path))
    const systemName = desystemize(path)
    assert(system[systemName], `unknown system covenant: ${systemName}`)
    if (!this.#overloadPulses.has(path)) {
      const covenant = system[systemName]
      const pulse = await Pulse.createCovenantOverload(covenant)
      this.#overloadPulses.set(path, pulse)
    }
    return this.#overloadPulses.get(path)
  }
  #isOverload(path) {
    path = desystemize(path)
    return !!this.#overloads[path]
  }
  async #getOverloadPulse(path) {
    assert(this.#isOverload(path))
    path = desystemize(path)
    if (!this.#overloadPulses.has(path)) {
      const covenant = this.#overloads[path]
      const pulse = await Pulse.createCovenantOverload(covenant)
      this.#overloadPulses.set(path, pulse)
    }
    return this.#overloadPulses.get(path)
  }
  async load(pulse, timeout) {
    assert(pulse instanceof Pulse)
    const overloads = this.#overloads
    let whisper
    if (pulse.getConfig().isPierced) {
      const chainId = pulse.getAddress().getChainId()
      if (!this.#whispers.has(chainId)) {
        this.#whispers.set(chainId, [])
      }
      whisper = this.#whispers.get(chainId)
      assert(!whisper.length, `whisper already has ${whisper.length} entries`)
    }
    return await IsolateContainer.create(pulse, overloads, whisper, timeout)
  }
  getWhispersReference(pulse) {
    assert(pulse instanceof Pulse)
    // TODO handle config changing partway thru execution
    assert(pulse.getConfig().isPierced, `chain is not side effect capable`)

    const chainId = pulse.getAddress().getChainId()
    const whispers = this.#whispers.get(chainId)
    assert(Array.isArray(whispers), `no whisper array for ${chainId}`)
    return whispers
  }
}

const desystemize = (path) => {
  if (path.startsWith('/system:/')) {
    return path.substring('/system:/'.length)
  }
  return path
}
