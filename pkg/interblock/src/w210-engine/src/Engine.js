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
  AsyncTrail,
  AsyncRequest,
} from '../../w008-ipld'
import { wrapReduce } from '../../w010-hooks'
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
    this.#hints.subscribe((...args) => this.#hints(...args))
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
  #hint(targetAddress, remotePulselink) {
    // gets hinted that a chain has updated, so begins seeking confirmation
    // looks up what chains it is hosting, and gets what chains are subscribed ?
    // gets told because a foreign validator has seen a block increase,
    // and has been proven to that we are hosting a targetted chain ?
    // Adds the interpulses into the softpulse and calls increase
    debug(`#hint`, targetAddress, remotePulselink)
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
          const reply = tx[stream].getReply(requestIndex)
          debug('tracker match', reply.type)
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
    let { pending } = softpulse.provenance.dmz
    let counter = 0
    while (softpulse.getNetwork().channels.rxs.length && counter++ < 10) {
      // SYSTEM
      let systemTrail
      const rxSystemReply = await network.rxSystemReply()
      if (rxSystemReply) {
        debug('system reply', rxSystemReply.reply.type)
        network = await network.shiftSystemReply()
        softpulse = softpulse.setNetwork(network)
        if (!rxSystemReply.isPromise()) {
          systemTrail = pending.findTrail(rxSystemReply)
          assert(systemTrail)
          systemTrail = systemTrail.settleTx(rxSystemReply)
          systemTrail = systemTrail.setMap({ pulse: softpulse })
        }
      }

      if (!systemTrail) {
        const rxSystemRequest = await network.rxSystemRequest()
        if (rxSystemRequest) {
          systemTrail = AsyncTrail.createWithPulse(rxSystemRequest, softpulse)
          pending = pending.addTrail(systemTrail)
        }
      }

      if (systemTrail) {
        debug('system request', systemTrail.origin.request.type)
        systemTrail = await wrapReduce(systemTrail, reducer)
        softpulse = systemTrail.pulse
        network = softpulse.getNetwork()
        const [nextTrail, nextNetwork] = await txTrail(systemTrail, network)
        systemTrail = nextTrail
        network = nextNetwork
        if (systemTrail.isOriginTrail() || !systemTrail.isPending()) {
          const reply = systemTrail.getReply()
          debug(`transmit trail reply`, reply.type)
          network = await network.txSystemReply(reply)
        }
        pending = pending.updateTrail(systemTrail)
      }

      // REDUCER
      let reducerTrail
      const rxReducerReply = await network.rxReducerReply()
      if (rxReducerReply) {
        debug('reducer reply', rxReducerReply.reply.type)
        if (_isPending) {
          // accumulate this reply
        }
        // discard reply via shift as reducers never receive replies
        network = await network.shiftReducerReply()
      }

      if (!reducerTrail) {
        const rxReducerRequest = await network.rxReducerRequest()
        if (rxReducerRequest) {
          reducerTrail = AsyncTrail.create(rxReducerRequest)
        }
      }

      if (reducerTrail) {
        // figure out what has already been transmitted
        // resolve the ids of the pending requests, so they can be matched
        debug('reducer request', reducerTrail.origin.request.type)
        reducerTrail = await isolate.reduce(reducerTrail)
        assert(reducerTrail instanceof AsyncTrail)

        // do the transmissions, setting IDs as we go
        const [nextTrail, nextNetwork] = await txTrail(reducerTrail, network)
        reducerTrail = nextTrail
        network = nextNetwork

        if (reducerTrail.isOriginTrail() || !reducerTrail.isPending()) {
          const reply = reducerTrail.getReply()
          network = await network.txReducerReply(reply)
        }
      }
      softpulse = softpulse.setNetwork(network)
    }

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
      const channel = await network.channels.getChannel(channelId)
      const { address, tx } = channel
      assert(address.isRemote())
      if (tx.isGenesisRequest()) {
        const spawnOptions = tx.getGenesisSpawnOptions()
        const genesis = await pulse.deriveChildGenesis(spawnOptions)
        await this.#endurance.endure(genesis)
        debug(`genesis endured`, genesis.getAddress())
      }
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

    const requestId = dmz.network.getNextIoRequestId(request)
    const tracker = { requestId }
    const promise = new Promise((resolve, reject) => {
      tracker.resolve = resolve
      tracker.reject = reject
    })
    this.#promises.add(tracker)

    const network = await dmz.network.pierceIo(request)
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

const txTrail = async (trail, network) => {
  assert(trail instanceof AsyncTrail)
  assert(network instanceof Network)
  const txs = []
  for (const tx of trail.txs) {
    assert(tx instanceof AsyncRequest)
    assert(!tx.isSettled())
    assert(!tx.requestId)
    assert(tx.to)
    const { request, to } = tx
    debug('tx request: %s to: %s', request.type, to)

    // resolve the name to a channelId
    if (!(await network.hasChannel(to))) {
      network = await network.addDownlink(to)
    }
    let channel = await network.getChannel(to)
    const requestId = channel.getNextRequestId(request)
    txs.push(tx.setId(requestId))
    channel = channel.txRequest(request)
    network = await network.updateChannel(channel)
  }
  trail = trail.updateTxs(txs)
  return [trail, network]
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
