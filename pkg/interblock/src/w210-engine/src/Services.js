import assert from 'assert-fast'
import {
  Provenance,
  Keypair,
  Address,
  Pulse,
  PulseLink,
  State,
  RxRequest,
  AsyncTrail,
} from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:engine:services')

export class Scale {
  // fires up more engine instances to form a distributed engine
  // in a trusted environment such as multicore cpu or aws lambda
  watchdog(pulse) {
    // notify the watchdog whenever lock is aquired, or lock was taken
    // watchdog is responsible for continuity of operations.
    // may be superseded by running multiple engines
    debug('watchdog')
  }
}

export class Endurance {
  #mockIpfs = new Map()
  #mockSoftIpfs = new Map()
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(pulse.isVerified())
    // stores ipfs blocks, with optional distribution minimums
    this.#mockIpfs.set(pulse.cid.toString(), pulse)
    const address = pulse.getAddress().getChainId().substring(0, 14)
    const pulselink = pulse.getPulseLink().cid.toString().substring(0, 14)
    debug(`endure`, address, pulselink)
  }
  async recoverPulse(pulselink) {
    // get ipfs block any way possible
    // place a resolver function in the pulse to look up the hamt
    assert(pulselink instanceof PulseLink)
    assert(this.#mockIpfs.has(pulselink.cid.toString()))
    return this.#mockIpfs.get(pulselink.cid.toString())
  }
  async recoverInterpulse(pulselink, target) {
    assert(pulselink instanceof PulseLink)
    assert(target instanceof Address)
  }
  async softEndure(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert(!pulse.isVerified())
    const key = pulse.getAddress().getChainId()
    assert(key)
    this.#mockSoftIpfs.set(key, pulse)
  }
  async softRecover(softPulselink) {
    assert(this.#mockSoftIpfs.has())
    throw new Error('not implemented')
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
}
class CryptoLock {
  #keypair
  #softpulse
  static async create(softpulse, keypair) {
    assert(softpulse instanceof Pulse)
    assert(softpulse.isModified())
    const instance = new this()
    instance.#keypair = keypair
    instance.#softpulse = softpulse
    return instance
  }
  release(pulse) {
    // must be a signed pulse
    debug(`released`, pulse.getAddress(), pulse.getPulseLink())
  }
  async sign(provenance) {
    assert(provenance instanceof Provenance)
    // verify this is the natural successor of the lock currently held
    debug('sign', provenance.address)
    const signature = await this.#keypair.sign(provenance)
    return [this.#keypair.publicKey, signature]
  }
}
export class Crypto {
  #keypair
  constructor(keypair = Keypair.createCI()) {
    this.#keypair = keypair
  }
  lock(softpulse) {
    debug('lock')
    // get the address out of the softpulse
    // includes a new timestamp, and has the chainId in it
    // timestamp is taken from the softpulse, and must be within delta
    return CryptoLock.create(softpulse, this.#keypair)
  }
}

import { wrapReduce } from '../../w010-hooks'
export class IsolateContainer {
  #reducer
  static async create(pulse, overloads, timeout) {
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert.strictEqual(typeof overloads, 'object')
    assert(Number.isInteger(timeout))
    const { covenant } = pulse.provenance.dmz.config

    // have fun: https://github.com/dreamcatcher-tech/dreamcatcher-stack/blob/master/pkg/interblock/src/w006-schemas/IpldSchemas.md#covenant

    let reducer = (request) => {
      debug(`default reducer`, request)
    }
    if (overloads[covenant]) {
      reducer = overloads[covenant].reducer
    }
    return new IsolateContainer(reducer, timeout)
  }
  constructor(reducer) {
    // get the covenant out of the pulse
    this.#reducer = reducer
  }

  async unload() {
    debug('unload')
  }
  async reduce(trail) {
    assert(trail instanceof AsyncTrail)
    debug('reduce', trail.origin.request.type)
    trail = await wrapReduce(trail, this.#reducer)
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
  constructor() {}
  overload(overloads) {
    assert.strictEqual(typeof overloads, 'object')
    // the dev supplied covenants to override blockchained ones
    this.#overloads = overloads
  }
  async load(pulse, timeout) {
    debug('load')
    const overloads = this.#overloads
    return await IsolateContainer.create(pulse, overloads, timeout)
  }
}
