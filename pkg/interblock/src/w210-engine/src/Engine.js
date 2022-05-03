import assert from 'assert-fast'
import Debug from 'debug'
import {
  Channel,
  RxRequest,
  Address,
  Pulse,
  PulseLink,
  Request,
} from '../../w008-ipld'
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
    let softpulse = await this.#hints.softLatest(address)
    const lock = await this.#crypto.lock(softpulse)
    // TODO should return a pulselink, not a pulse
    if (!softpulse) {
      debug(`no softpulse found`)
      return
    }
    assert(softpulse instanceof Pulse)

    // load up the isolation - uses none if this is trusted code
    const isolate = await this.#isolate.load(softpulse)

    let network = softpulse.getNetwork()
    // while (pulse.getNetwork().channels.rxs.length){

    const rxSystemReply = await network.rxSystemReply()
    if (rxSystemReply) {
      debug('system reply')
    }

    const rxSystemRequest = await network.rxSystemRequest()
    if (rxSystemRequest) {
      debug('system request')
    }

    const state = softpulse.getState()
    const rxReducerReply = await network.rxReducerReply()
    if (rxReducerReply) {
      debug('reducer reply')
      // check pending to see if this should be accumulated
      // if accumulation is completed by this reply, execute it
      // else discard the reply by doing shift
    }

    const rxReducerRequest = await network.rxReducerRequest()
    if (rxReducerRequest) {
      debug('reducer request', rxReducerRequest)
      const replies = []
      const reduction = await isolate.reduce(state, rxReducerRequest, replies)
      // possibly go pending
      // do the transmissions
      // if reduction includes a reply to orign request, use instead
      network = await network.txReducerReply()
    }

    // }

    // after processing, crush and sign the pulse
    softpulse = softpulse.setNetwork(network)
    const provenance = await softpulse.provenance.crush()
    const [publicKey, signature] = await this.#crypto.sign(provenance)
    softpulse = softpulse.addSignature(publicKey, signature)
    // do not add crushed provenance else diffBlocks will be wiped
    const pulse = await softpulse.crush()

    // then store the new blocks created
    await this.#endurance.endure(pulse)

    // then send out all the transmissions
    await this.#transmit(pulse)
    // release the lock

    if (pulse.getAddress().equals(this.#address)) {
      this.#latest = pulse
      // if the pulse has this address, then check if any piercings are resolved
      const { tx } = await pulse.getNetwork().getIo()
      if (!tx.isEmpty()) {
        // get all the replies out
        // see if any of them are being waited upon
        // resolve and clear from #promises any that are
        for (const tracker of this.#promises) {
          debug('tracker', tracker)
          const { stream, requestIndex } = tracker.txRequest
          // see if the replies contain a settle
          if (tx[stream].hasReply(requestIndex)) {
            const reply = tx[stream].getReply(requestIndex)
            if (reply.isPromise()) {
              continue
            }
            this.#promises.delete(tracker)
            if (reply.isResolve()) {
              tracker.resolve(reply.payload)
            } else {
              assert(reply.isRejection())
              tracker.reject(reply.payload)
            }
          }
        }
      }
    }
  }
  #promises = new Set()
  async #transmit(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const pulselink = pulse.getPulseLink()
    const network = pulse.getNetwork()
    for (const channelId of network.channels.txs) {
      const { address } = await network.channels.getChannel(channelId)
      assert(address.isRemote())
      this.#hints.announce(address, pulselink)
    }
  }
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
    io = io.txRequest(request)
    const txRequest = io.getTipRequest(request)
    const tracker = { txRequest }
    const promise = new Promise((resolve, reject) => {
      tracker.resolve = resolve
      tracker.reject = reject
    })
    this.#promises.add(tracker)

    const network = await dmz.network.updateIo(io)
    soft = soft.setNetwork(network)
    await this.#endurance.softEndure(soft)
    // TODO retry if multithread or multi validator and fail
    await this.#hints.softAnnounce(soft)

    await this.#increase(address)

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
