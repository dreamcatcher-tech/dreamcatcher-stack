import assert from 'assert-fast'
import { Keypair, Address, Pulse, PulseLink } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interblock:engine')

/**

      

      seems that connections to a chain complex should be given access to approot
        announce should only consider them if their chain changed
        they only have access to the child they are subscribing to ?   
        approot:address where approot is used as a rally point
        outside the complex, we annouce based on approot:address, and only to those who have permission  

? should we make all access to the complex occur thru a socket chain ?
  means all actions of the foreign chain are announce free
  socket can be kept updated with latest approot, and might be outside of the complex ?
  act like chroot to the remote chain
  socket and home dir can be the same - the place where user sessions enter the complex
  avoids having huge spread of remote connections across the complex
  can cut access to a user instantly
  read access to the user is unaffected by the socket, only write actions have one extra hop  
  ? how to pass approot down the socket whenever it changes ?
    ends up in an endless loop, as socket needs to update approot when it changes
    shell could update itself, socket can pass on the latest approot any time there is activity
     */

/**
 * hints is the object representing transient relationships like 'latest'
 * as well as messaging, like announcements of new approots
 * in test, announces can be connected together
 * to allow multiple engines to be tested together
 *
 * Subscriptions are only to approots, to lower dht traffic and topic count.
 * External connections are announced to the approot topic.
 */
export class Hints {
  #self
  #mockLatestDht = new Map()
  #mockSoftLatestDht = new Map()
  set self(address) {
    assert(address instanceof Address)
    this.#self = address
  }
  get self() {
    return this.#self
  }

  latest(address) {
    // get latest out of dht, using local version first, then remote
    // returns a pulselink
    assert(address instanceof Address)
    return this.#mockLatestDht.get(address.cid.toString())
  }
  /**
   *
   * @param {*} address
   * @param {*} pulselink
   *
   * if all remotes are within the same chaincomplex, do not announce
   * if the foreign chain has access to the approot, do not announce
   */
  announce(address, pulselink) {
    assert(address instanceof Address)
    assert(pulselink instanceof PulseLink)
    debug('announce', address, pulselink)
    // TODO enforce approot announces only
    this.#mockLatestDht.set(address.cid.toString(), pulselink)
  }
  subscribe(address) {
    // to get regular updates
    // should seek out the approot if possible, and subscribe to that
  }
  async softLatest(address) {
    // the latest softpulse, or pool
    assert(address instanceof Address)
    return this.#mockSoftLatestDht.get(address.cid.toString())
  }
  async softAnnounce(pulse) {
    // TODO ensure no conflict with the current soft pulse
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert(!pulse.isVerified())
    const address = pulse.getAddress()
    this.#mockSoftLatestDht.set(address.cid.toString(), pulse)
    // TODO when multivalidator, trigger increase and seek
  }
}
export class Scale {
  // fires up more engine instances to form a distributed engine
  // in a trusted environment
  watchdog(address) {
    // notify the watchdog whenever lock is aquired, or lock was taken
    // watchdog is responsible for continuity of operations.
    // may be superseded by running multiple engines
  }
}
/**
 * Provides a cache for IPFS interactions too
 * Allows separate
 */
export class Endurance {
  #mockIpfs = new Map()
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(pulse.isVerified())
    // stores ipfs blocks, with optional distribution minimums
    // could be a softpulse, or a verified pulse
    this.#mockIpfs.set(pulse.cid.toString(), pulse)
  }
  async softEndure(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert(!pulse.isVerified())
    // stores ipfs blocks, with optional distribution minimums
    // could be a softpulse, or a verified pulse
    const key = pulse.currentCrush.cid.toString()
    assert(key)
    this.#mockIpfs.set(key, pulse)
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
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage any time
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
  }
  unlock(pulse) {
    // must be a signed pulse
  }
  async sign(softpulse) {
    // verify this is the natural successor of the lock currently held
    debug('sign')
    // do the signature
    // insert back into the softpulse
    // return the softpulse
    const signature = await this.#keypair.sign(softpulse.provenance)
    return [this.#keypair.publicKey, signature]
  }
}

class IsolateContainer {
  #reducer
  #timeout
  static async create(pulse, overloads, timeout) {
    const reducer = (state, action) => {
      debug('state', state, 'action', action)
      return state
    }
    return new IsolateContainer(reducer, timeout)
  }
  constructor(reducer, timeout) {
    // get the covenant out of the pulse
    this.#reducer = reducer
    this.#timeout = timeout
  }
  async unload() {
    debug('unload')
  }
  async reduce(state, rxRequest, accumulator) {
    debug('reduce')
    // moves the isolate forwards, returns a reduction
    // wrap the reducer in the hook function
    const action = rxRequest.getAction()
    const reduction = await this.#reducer(state, action)
    // get the state out of the reduction and cache it

    return reduction
  }
  async effects() {
    // cannot modify the state at all
    // after invocation, can never call reduce again
    debug('effects')
  }
}
export class Isolate {
  constructor(overloads) {
    // the dev supplied covenants to override blockchained ones
    this.overloads = overloads
  }
  async load(pulse, timeout) {
    debug('load')
    const { overloads } = this
    return await IsolateContainer.create(pulse, overloads, timeout)
  }
}
