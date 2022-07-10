import assert from 'assert-fast'
import Debug from 'debug'
import {
  Network,
  Address,
  Pulse,
  PulseLink,
  Request,
  Interpulse,
  Channel,
} from '../../w008-ipld'
import { reducer } from './reducer'
import { Isolate, Endurance, Scale } from './Services'
import { Crypto, CryptoLock } from './Crypto'
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
  get logger() {
    return this.#endurance.logger
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
  /**
   * when an interpulse event is received:
   *    it is already vetted, so know it is valid
   *    get the pool, and attempt to fit it into the pool
   *    if it does not fit, search its precedents until we find one that fits
   *    wait until we have lock on the chain
   *    modify the pool
   *    send a pool event
   *
   * when a pool event is received:
   *    wait until we have lock on the chain
   *      we might already have it from the interpulse subscription
   *    ? ensure the pool is sane based on the latest pulse ?
   *
   * when a pulse event is received:
   *    update the pool storage
   */
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
    this.#hints.poolSubscribe((address) => {
      assert(address instanceof Address)
      debug(`poolSubscribe`, address)
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
      const address = pulse.getAddress()
      debug(`pulseSubscribe`, address)
      // TODO recalculate the pool, store this pulse
    })
    await this.#hints.pulseAnnounce(base)
  }
  async #interpulse(target, source, pulse) {
    // gets hinted that a chain has updated, so begins seeking confirmation
    // looks up what chains it is hosting, and gets what chains are subscribed ?
    assert(target instanceof Address)
    assert(target.isRemote())
    assert(source instanceof Address)
    assert(source.isRemote())
    assert(pulse instanceof Pulse)
    debug(`interpulse hint received`, target, source, pulse)

    const interpulse = Interpulse.extract(pulse, target)
    // TODO get the softpulse and see if we are still relevant ?
    // TODO insert a queue to capture interpulses before block making
    const lock = await this.#crypto.lock(target)
    // TODO check that the change we want to make is still valid
    if (interpulse.tx.isGenesisRequest()) {
      const spawnOptions = interpulse.tx.getGenesisSpawnOptions()
      const genesis = await pulse.deriveChildGenesis(spawnOptions)
      await this.#endurance.endure(genesis)
      await this.#hints.pulseAnnounce(genesis)
      debug(`genesis endured`, genesis.getAddress())
      // TODO ? make a unified way to fetch the latest pool item ?
      // pools are always processed as soon as they are modified
      let poolWithParent = await genesis.generateSoftPulse(pulse)
      poolWithParent = await poolWithParent.ingestInterpulse(interpulse)
      await this.#hints.poolAnnounce(poolWithParent)
      return this.#increase(poolWithParent, lock)
    }

    let pool = await this.#hints.poolLatest(target)
    if (pool) {
      assert(pool instanceof Pulse)
    } else {
      const pulselink = await this.#hints.pulseLatest(target)
      debug(`using latest`, pulselink)
      const pulse = await this.#endurance.recoverPulse(pulselink)
      pool = await pulse.generateSoftPulse()
    }
    pool = await pool.ingestInterpulse(interpulse)
    await this.#hints.poolAnnounce(pool)
    return this.#increase(pool, lock)
  }
  async #increase(pool, lock) {
    assert(pool instanceof Pulse)
    assert(pool.getNetwork().channels.rxs.length)
    assert(lock instanceof CryptoLock)
    assert(lock.isValid())
    await this.#scale.watchdog(pool)

    pool = await this.#reducer(pool)
    const provenance = await pool.provenance.crush()
    const signature = await lock.sign(provenance)
    pool = pool.addSignature(lock.publicKey, signature)
    const pulse = await pool.crush()

    await this.#endurance.endure(pulse)
    if (pulse.getAddress().equals(this.address)) {
      this.#latest = pulse
    }
    await this.#hints.pulseAnnounce(pulse)
    await this.#hints.softRemove(pulse.getAddress())
    // TODO update all the subscriptions
    await lock.release()
    await this.#transmit(pulse)
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
    const network = pulse.getNetwork()
    for (const channelId of network.channels.txs) {
      const channel = await network.channels.getChannel(channelId)
      const { address } = channel
      assert(address.isRemote())
      const target = address
      const source = pulse.getAddress()
      this.#hints.interpulseAnnounce(target, source, pulse)
      // TODO check if we are the validator, else rely on announce
      this.#interpulse(target, source, pulse)
    }
    if (pulse.getAddress().equals(this.address)) {
      const io = await network.getIo()
      await this.#checkPierceTracker(io, this.address)
    }
  }
  subscribe(callback) {
    assert.strictEqual(typeof callback, 'function')
    // TODO gets called each time a new block is made
  }
  #pierceLocks = new Map()
  async pierce(request, address = this.#address) {
    // the origin of external stimulus across all engines
    // return a promise that resolves when the promise returns AND
    // the engine has settled
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(request instanceof Request)
    debug(`pierce`, request.type, address)
    const chainId = address.getChainId()
    const tracker = { request }
    const promise = new Promise((resolve, reject) =>
      Object.assign(tracker, { resolve, reject })
    )
    if (this.#pierceLocks.has(chainId)) {
      const pierceQueue = this.#pierceLocks.get(chainId)
      pierceQueue.push(tracker)
      return promise
    }
    const pierceQueue = [tracker]
    this.#pierceLocks.set(chainId, pierceQueue)

    const lock = await this.#crypto.lock(address)

    // get the latest softpulse from the dht
    // repeatedly attempt to insert the pierce
    let pulselink = await this.#hints.poolLatest(address)
    if (!pulselink) {
      pulselink = await this.#hints.pulseLatest(address)
    }
    assert(pulselink instanceof PulseLink, `No chain found: ${address}`)
    let pool = await this.#endurance.recoverPulse(pulselink)
    assert(pool instanceof Pulse)
    assert(address.equals(pool.getAddress()))
    if (pool.isVerified()) {
      pool = await pool.generateSoftPulse()
    }
    const { dmz } = pool.provenance
    assert(dmz.config.isPierced, `Attempt to pierce unpierced chain`)
    while (pierceQueue.length) {
      debug(`pierceQueue.length`, pierceQueue.length)
      const tracker = pierceQueue.shift()
      const { request } = tracker
      const [network, requestId] = await pool.getNetwork().pierceIo(request)
      pool = pool.setNetwork(network)
      tracker.requestId = requestId
      delete tracker.request
      this.#piercePromises.add(tracker)
    }
    this.#pierceLocks.delete(chainId)
    await this.#hints.poolAnnounce(pool)
    this.#increase(pool, lock)
    return promise
  }
  /**
   * If endurance was the reference store of things like latest, and pool
   * And if it was controlled by having a lock to access it
   * endure(pulse, lock)
   * pool(pool, lock)
   * But it has to be able to have ipfs plugged in to it easily
   */
  #piercePromises = new Set()
  async #checkPierceTracker(io, address) {
    assert(io instanceof Channel)
    assert.strictEqual(io.channelId, Network.FIXED_IDS.IO)
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(address.equals(this.address))
    const { tx } = io
    if (!tx.isEmpty()) {
      for (const tracker of this.#piercePromises) {
        const { stream, requestIndex } = tracker.requestId
        debug(tracker)
        // see if the replies contain a settle
        if (tx[stream].hasReply(requestIndex)) {
          const reply = tx[stream].getReply(requestIndex)
          debug('tracker match', reply.type)
          if (reply.isPromise()) {
            continue
          }
          this.#piercePromises.delete(tracker)
          if (reply.isResolve()) {
            tracker.resolve(reply.payload)
          } else {
            assert(reply.isRejection())
            tracker.reject(reply.getRejectionError())
          }
        }
      }
    }
  }
  async multiThreadStart(threadCount) {}
  async multiThreadStop() {}
  async ipfsStart(privateNetworkKey) {}
  async ipfsStop() {}
}
