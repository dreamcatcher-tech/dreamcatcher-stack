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
    assert(!whisper || whisper instanceof Map)
    assert(Number.isInteger(timeout))
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
      assert(whisper instanceof Map, `whisper is required for effects`)
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
  #whispers = new Map() // chainId -> { key -> fn }

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
        this.#whispers.set(chainId, new Map())
      }
      whisper = this.#whispers.get(chainId)
      assert(whisper.size === 0, `whisper already has ${whisper.size} entries`)
    }
    // TODO force all whispers to have been popped before a later pulse
    // or block pushing any whispers if the previous pulse hasn't been popped
    return await IsolateContainer.create(pulse, overloads, whisper, timeout)
  }
  popAsyncWhisper(pulse, request) {
    assert(pulse instanceof Pulse)
    assert(request instanceof Request)
    assert.strictEqual(request.type, '@@ASYNC')
    // TODO handle config changing partway thru execution
    assert(pulse.getConfig().isPierced, `chain is not side effect capable`)
    const { key } = request.payload
    assert.strictEqual(typeof key, 'string')

    const chainId = pulse.getAddress().getChainId()
    assert(this.#whispers.has(chainId), `no whispers for ${chainId}`)
    const whispers = this.#whispers.get(chainId)
    if (!whispers.has(key)) {
      debugger
    }
    assert(whispers.has(key), `no whisper for ${key}`)

    const fn = whispers.get(key)
    whispers.delete(key)
    return fn
  }
}

const desystemize = (path) => {
  if (path.startsWith('/system:/')) {
    return path.substring('/system:/'.length)
  }
  return path
}
