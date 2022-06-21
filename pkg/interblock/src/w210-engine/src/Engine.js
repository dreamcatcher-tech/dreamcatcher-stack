import assert from 'assert-fast'
import Debug from 'debug'
import {
  Network,
  Channel,
  RxRequest,
  Address,
  Pulse,
  PulseLink,
  Request,
  Reply,
  Provenance,
} from '../../w008-ipld'
import { wrapReduce, Reduction } from '../../w010-hooks'
import { actions, reducer } from '../../w017-system-reducer'
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
  #logging = false

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
  static async createCI(opts = {}) {
    const ciOptions = { ...opts, CI: true }
    return await this.create(ciOptions)
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
  overload(overloads) {
    assert.strictEqual(typeof overloads, 'object')
    this.#isolate.overload(overloads)
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
    // TODO should return a pulselink, not a pulse
    let softpulse = await this.#hints.softLatest(address)
    if (!softpulse) {
      debug(`no softpulse found`)
      return
    }
    assert(softpulse instanceof Pulse)
    assert(softpulse.getNetwork().channels.rxs.length)

    const lock = await this.#crypto.lock(softpulse)
    await this.#scale.watchdog(softpulse)

    softpulse = await this.#reducer(softpulse)
    const provenance = await softpulse.provenance.crush()
    const [publicKey, signature] = await lock.sign(provenance)
    softpulse = softpulse.addSignature(publicKey, signature)
    // do not add crushed provenance else diffBlocks will be wiped
    const pulse = await softpulse.crush()

    // then store the new blocks created
    await this.#endurance.endure(pulse)
    // TODO update all the subscriptions, including the pierceTracker
    await this.#checkPierceTracker(pulse) // but should be subscription based
    // then send out all the transmissions
    await this.#transmit(pulse)
    // release the lock
    await lock.release()
  }
  #promises = new Set()
  async #checkPierceTracker(pulse) {
    if (!pulse.getAddress().equals(this.#address)) {
      return
    }
    this.#latest = pulse
    // if the pulse has this address, then check if any piercings are resolved
    const { tx } = await pulse.getNetwork().getIo()
    if (!tx.isEmpty()) {
      for (const tracker of this.#promises) {
        const { stream, requestIndex } = tracker.requestId
        // see if the replies contain a settle
        if (tx[stream].hasReply(requestIndex)) {
          debug('tracker match', requestIndex)
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
  async #reducer(softpulse) {
    assert(softpulse instanceof Pulse)
    assert(softpulse.isModified())
    const timeout = 2000
    const isolate = await this.#isolate.load(softpulse, timeout)
    let network = softpulse.getNetwork()
    let counter = 0
    while (softpulse.getNetwork().channels.rxs.length && counter++ < 10) {
      // SYSTEM
      const rxSystemReply = await network.rxSystemReply()
      if (rxSystemReply) {
        debug('system reply')
        break
      }

      const rxSystemRequest = await network.rxSystemRequest()
      if (rxSystemRequest) {
        debug('system request', rxSystemRequest)
        let { provenance } = softpulse
        const tick = () => reducer(provenance, rxSystemRequest)
        const { result, txs } = await wrapReduce(tick)
        assert(result instanceof Provenance)
        // do the transmissions
        // update the accumulator
        break
      }

      // REDUCER
      const state = softpulse.getState()
      const _isPending = false
      const rxReducerReply = await network.rxReducerReply()
      if (rxReducerReply) {
        debug('reducer reply', rxReducerReply)
        if (_isPending) {
          // accumulate this reply
        }
        // discard reply via shift as reducers never receive replies
        network = await network.shiftReducerReply()
        break
      }

      let rxReducerRequest, replies
      if (_isPending) {
        const isAccumulated = false
        if (isAccumulated) {
          //  fetch replies, and execute origin
        } else {
          break
        }
      } else {
        rxReducerRequest = await network.rxReducerRequest()
        replies = []
      }

      if (rxReducerRequest) {
        // figure out what has already been transmitted
        // resolve the ids of the pending requests, so they can be matched
        debug('reducer request', rxReducerRequest.type)
        const reduction = await isolate.reduce(state, rxReducerRequest, replies)
        assert(reduction instanceof Reduction)
        debug('reduction', reduction)
        // possibly go pending
        // do the transmissions
        // update the accumulator
        let defaultReply
        for (const tx of reduction.transmissions) {
          if (Reply.isReplyType(tx.type)) {
            debug('reply', tx)
            // if reduction includes a reply to orign request, use instead
          } else {
            const { type, payload, binary } = tx
            const request = Request.create(type, payload, binary)
            debug('tx request', request)
            // resolve the name to a channelId
            const { to } = tx
            debug('to', to)
            if (!(await network.hasChannel(to))) {
              network = await network.addDownlink(to)
            }
            let channel = await network.getChannel(to)
            const requestId = channel.getNextRequestId(request)
            channel = channel.txRequest(request)
            network = await network.updateChannel(channel)
          }
        }
        network = await network.txReducerReply(defaultReply)
      }
    }

    softpulse = softpulse.setNetwork(network)
    return softpulse
  }
  async #transmit(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const pulselink = pulse.getPulseLink()
    const network = pulse.getNetwork()
    for (const channelId of network.channels.txs) {
      if (channelId === Network.FIXED_IDS.IO) {
        continue
      }
      const { address } = await network.channels.getChannel(channelId)
      assert(address.isRemote())
      this.#hints.announce(address, pulselink)
    }
  }
  subscribe(callback) {
    assert.strictEqual(typeof callback, 'function')
    // TODO gets called each time a new block is made
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
    const requestId = io.getNextRequestId(request)
    io = io.txRequest(request)
    const tracker = { requestId }
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
  enableLogging() {
    this.#logging = true
  }
}

/**
 * The top level ORM object.
 * Assembles an Engine with all the services it needs to operate.
 * Wraps engine with useful functions for devs.
 * Loads the shell to be loaded at the root block.
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
