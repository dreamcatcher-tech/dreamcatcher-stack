import assert from 'assert-fast'
import Debug from 'debug'
import { Address, Io, Pulse, PulseLink, Request } from '../../w008-ipld'
import { Isolate, Crypto, Endurance, Scale, Hints } from './Services'
const debug = Debug('interblock:engine')
/**
 * The Engine of Permanence
 * Reacts to external stimulus.
 * Transmit can be connected to intake to make it run till exhaustion.
 * Takes announcements, and parses into increase events.
 * Uses the models and the reducer to generate the next Pulse.
 * Transmits the Pulse to the next engine.
 * Concerned only with exhausting the services so the system has settled.
 *
 */
export class Engine {
  #address // the address of the base chain of this engine
  #latest // latest block in the base chain of this engine

  #isolate
  #crypto
  #endurance
  #scale
  #hints
  get address() {
    return this.#address
  }
  get latest() {
    return this.#latest
  }
  static async create(opts = {}) {
    const instance = new Engine(opts)
    const { CI = false } = opts // make deterministic chain addresses
    await instance.#init(CI)
    return instance
  }
  constructor({ isolate, crypto, endurance, scale, hints } = {}) {
    this.#isolate = isolate || new Isolate()
    this.#crypto = crypto || new Crypto()
    this.#endurance = endurance || new Endurance()
    this.#scale = scale || new Scale()
    this.#hints = hints || new Hints()
  }
  async #init(CI) {
    // check if a base exists already, if so, get the latest block fully
    const { self } = await this.#hints
    if (self) {
      assert(self instanceof Address)
      const pulselink = await this.#hints.latest(self)
      assert(pulselink instanceof PulseLink)
      const latest = await this.#endurance.recoverPulse(pulselink)
      assert(latest instanceof Pulse)
      this.#latest = latest
      this.#address = self
      return
      // TODO recover subscriptions
    }
    const base = await Pulse.createRoot(CI)
    this.#address = base.getAddress()
    this.#hints.self = this.#address
    await this.#endurance.endure(base)
    this.#hints.announce(this.#address, base.getPulseLink())
    this.#latest = base

    this.#hints.subscribe(this.#address, (pulse) => {
      assert(pulse instanceof Pulse)
      // check if anything transmitted to io
      // if replies were sent, walk the whole lot, using *rx()
      pulse.dir()
    })
  }
  #hint(address, pulselink) {
    // gets hinted that a chain has updated, so begins seeking confirmation
    // looks up what chains it is hosting, and gets what chains are subscribed ?
    // gets told because a foreign validator has seen a block increase,
    // and has been proven to that we are hosting a targetted chain ?
    // Adds the interpulses into the softpulse and calls increase
  }
  async #increase(address) {
    // given a particular softpulse, attempt to advance it into a block
    // gain lock on it, or just notify the watchdog that you tried
    // process as many actions as possible before run out of resource
    // create a new block
    // perform all notification requirements, or scale them out to others
    const pulse = await this.#hints.softLatest(address)
    // TODO should return a pulselink, not a pulse
    if (!pulse) {
      debug(`no softpulse found`)
      return
    }
    assert(pulse instanceof Pulse)

    // create a state machine that will exhaust the pulse, using the services
    // while (pulse.getNetwork().channels.rxs.length){

    const network = pulse.getNetwork()
    // get the next system reply
    const rxSystemReply = await network.rxSystemReply()
    // process in dmz
    if (rxSystemReply) {
      debug('system reply')
    }

    const rxReducerReply = await network.rxReducerReply()
    if (rxReducerReply) {
      debug('reducer reply')
    }

    const rxSystemRequest = await network.rxSystemRequest()
    if (rxSystemRequest) {
      debug('system request')
    }

    const rxReducerRequest = await network.rxReducerRequest()
    if (rxReducerRequest) {
      debug('reducer request')
    }
    // get the next reducer reply
    // process in isolate
    // possibly go pending
    // get the next system request
    // process in dmz
    // get the next reducer request
    // process in isolate
    // possibly go pending

    // }
  }
  #promises = new Set()
  async pierce(request, address = this.#address) {
    // the origin of external stimulus across all engines
    // return a promise that resolves when the promise returns AND
    // the engine has settled
    assert(address instanceof Address)
    assert(request instanceof Request)

    // get the latest softpulse from the dht
    // repeatedly attempt to insert the pierce
    let pulselink = await this.#hints.softLatest(address)
    if (!pulselink) {
      pulselink = await this.#hints.latest(address)
    }
    assert(pulselink instanceof PulseLink, `No chain found: ${address}`)
    let soft = await this.#endurance.recoverPulse(pulselink)
    assert(soft instanceof Pulse)
    assert(address.equals(soft.getAddress()))
    if (soft.isVerified()) {
      soft = await soft.generateSoftPulse()
    }
    const { dmz } = soft.provenance
    assert(dmz.config.isPierced, `Attempt to pierce unpierced chain`)

    let io = await dmz.network.getIo()
    assert(io instanceof Io)
    io = io.txRequest(request)
    const rxRequest = io.getTipRequest(request)
    rxRequest.dir()

    // hook the id so we can process

    const network = await dmz.network.updateIo(io)
    soft = soft.setNetwork(network)
    await this.#endurance.softEndure(soft)
    // TODO retry if multithread or multi validator and fail
    await this.#hints.softAnnounce(soft)

    await this.#increase(address)
    // channelId, stream, index

    const promise = new Promise((resolve, reject) => {
      // insert these functions
      requestId.resolve = resolve
      requestId.reject = reject
    })
    this.#promises.add(requestId)

    return promise
  }
}

/**
 * The top level ORM object.
 * Assembles an Engine with all the services it needs to operate.
 * Wraps engine with useful functions for devs.
 * Requires the shell to be loaded at the root block.
 * Works with paths, whereas engine works with addresses.
 * Manages subscriptions to chains for view purposes only.
 */
export class Interblock {
  #engine // does the raw interactions with the model system
  static createCI() {
    // use ram versions of all services
  }
  constructor({ isolate, crypto, persist, scale, announce }) {
    // make a new engine instance using the supplied services, or defaults
  }
  #init() {
    // create the root chain if not present already
  }
  subscribe(callback, path = '/') {
    // call with event type, then data.  PENDING, RESOLVED, REJECTED ?
    // allow to use for subscribing to pending status of the root chain
  }
  actions(path = '/') {
    // get all the actions available at a particular path, as functions
  }
  async getState(path = '.') {
    // if no height, fetch latest
    // ? but with no height param, how can we look this up ?
  }
  set logging(isOn = false) {
    // turn on or off logging
  }
  async settle() {
    // wait until all pending activity has been exhausted
  }
  shutdown() {}

  // merge in all the shell actions here
}
