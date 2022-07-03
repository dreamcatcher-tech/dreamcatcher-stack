import assert from 'assert-fast'
import Debug from 'debug'
import {
  Network,
  Address,
  Pulse,
  PulseLink,
  Request,
  Interpulse,
} from '../../w008-ipld'
import { reducer } from './reducer'
import { Isolate, Crypto, Endurance, Scale } from './Services'
import { Hints } from './Hints'
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
      // subscriptions should be written to ipfs somehow
      // store them in the latest block representing this engine ?
      // TODO verify we have the crypto keys required to be this block
    }
    const base = await Pulse.createRoot(CI)
    this.#address = base.getAddress()
    this.#hints.self = this.#address
    this.#latest = base
    await this.#endurance.endure(base)
    this.#hints.softSubscribe((address) => {
      assert(address instanceof Address)
      debug(`softSubscribe`, address)
      // check if anything transmitted to io
      // if replies were sent, walk the whole lot, using *rx()
      return this.#increase(address)
    })
    this.#hints.interpulseSubscribe((target, source, pulselink) => {
      debug(`interpulseSubscribe`)
      return this.#interpulse(target, source, pulselink)
    })
    this.#hints.pulseSubscribe((pulse) => {
      assert(pulse instanceof Pulse)
      debug(`pulseSubscribe`, pulse.getAddress())
    })
    await this.#hints.pulseAnnounce(base)
  }
  async #interpulse(target, source, pulselink) {
    // gets hinted that a chain has updated, so begins seeking confirmation
    // looks up what chains it is hosting, and gets what chains are subscribed ?
    assert(target instanceof Address)
    assert(target.isRemote())
    assert(source instanceof Address)
    assert(source.isRemote())
    assert(pulselink instanceof PulseLink)
    debug(`interpulse hint received`, target, source, pulselink)

    // go get the remote pulselink
    const sourcePulse = await this.#endurance.recoverPulse(pulselink)
    const interpulse = Interpulse.extract(sourcePulse, target)
    // TODO walk backwards if this interpulse is too far forwards

    if (interpulse.tx.isGenesisRequest()) {
      const spawnOptions = interpulse.tx.getGenesisSpawnOptions()
      const genesis = await sourcePulse.deriveChildGenesis(spawnOptions)
      await this.#endurance.endure(genesis)
      await this.#hints.pulseAnnounce(genesis)
      debug(`genesis endured`, genesis.getAddress())
      let poolWithParent = await genesis.generateSoftPulse(sourcePulse)
      poolWithParent = await poolWithParent.ingestInterpulse(interpulse)
      return await this.#hints.softAnnounce(poolWithParent)
    }

    // TODO this should use pulselinks, or some other reference
    let pool = await this.#hints.softLatest(target)
    /**
     * How can a softpulse be updated while pulse is being executed upon ?
     * How can it be reset once a new pulse is made, and no modifications have been made ?
     * When would it ever happen ?
     * How are multiple interpulse hints handled while still blocking ?
     *
     * locking should be done with an array or some other primitive
     */
    if (pool) {
      assert(pool instanceof Pulse)
    } else {
      const pulselink = await this.#hints.pulseLatest(target)
      debug(`using latest`, pulselink)
      const pulse = await this.#endurance.recoverPulse(pulselink)
      pool = await pulse.generateSoftPulse()
    }
    pool = await pool.ingestInterpulse(interpulse)
    return this.#hints.softAnnounce(pool)
  }
  async #increase(address) {
    // given a particular softpulse, attempt to advance it into a block
    // gain lock on it, or just notify the watchdog that you tried
    // process as many actions as possible before run out of resource
    // from the execution, create a new block
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
    const pulse = await softpulse.crush()

    // then store the new blocks created
    await this.#endurance.endure(pulse)
    await this.#hints.pulseAnnounce(pulse)
    await this.#hints.softRemove(pulse.getAddress())
    // TODO update all the subscriptions, including the pierceTracker
    await this.#checkPierceTracker(pulse) // but should be subscription based
    // then send out all the transmissions
    await this.#transmit(pulse)
    // release the lock
    await lock.release(pulse)
  }
  async #reducer(softpulse) {
    assert(softpulse instanceof Pulse)
    assert(softpulse.isModified())
    const timeout = 2000 // TODO move to config
    const isolate = await this.#isolate.load(softpulse, timeout)
    return reducer(softpulse, isolate)
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
      const target = address
      const source = pulse.getAddress()
      this.#hints.interpulseAnnounce(target, source, pulselink)
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
      pulselink = await this.#hints.pulseLatest(address)
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
    // TODO retry if multithread or multi validator and fail
    await this.#hints.softAnnounce(soft)

    return promise
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
  enableLogging() {
    this.#logging = true
  }
}
