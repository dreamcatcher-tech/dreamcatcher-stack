import assert from 'assert-fast'
import posix from 'path-browserify'
import {
  Network,
  Address,
  Pulse,
  Request,
  Interpulse,
  Channel,
  Validators,
} from '../../w008-ipld'
import { reducer } from './reducer'
import { Isolate } from './Isolate'
import { Scale } from './Scale'
import { Crypto, CryptoLock } from './Crypto'
import { Endurance } from './Endurance'
import Debug from 'debug'
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
 * Aim to remove the interdependencies between services by marshalling
 * through the engine.
 */
export class Engine {
  #isolate
  #crypto
  #endurance
  #scale

  /** the address of the base chain of this engine */
  get selfAddress() {
    return this.#endurance.selfAddress
  }
  /** latest block in the base chain of this engine */
  get selfLatest() {
    return this.#endurance.selfLatest
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
    const { overloads } = opts
    if (overloads) {
      instance.overload(overloads)
    }
    const { CI = false } = opts // make deterministic chain addresses
    await instance.#init(CI)
    return instance
  }
  constructor({ isolate, crypto, endurance, scale } = {}) {
    // TODO remake the engine with a control flow calling into functions
    // and a generic queue management module
    this.#isolate = isolate || Isolate.create()
    this.#crypto = crypto || Crypto.createCI()
    this.#endurance = endurance || Endurance.create()
    this.#scale = scale || Scale.create()
  }
  overload(overloads) {
    assert.strictEqual(typeof overloads, 'object')
    this.#isolate.overload(overloads)
  }
  async #init(CI) {
    if (!this.#endurance.selfAddress) {
      const { publicKey } = this.#crypto
      const validators = Validators.create([publicKey])
      const latest = await Pulse.createRoot({ CI, validators })
      await this.#endurance.endure(latest)
    }
    assert(this.selfLatest instanceof Pulse)
    assert(this.selfAddress instanceof Address)
    assert(this.selfAddress.equals(this.selfLatest.getAddress()))
    // TODO verify we have the crypto keys required to be this block
  }
  #interpulseLocks = new Map()
  async #interpulse(target, source, pulse) {
    // gets hinted that a chain has updated, so begins seeking confirmation
    // looks up what chains it is hosting, and gets what chains are subscribed ?
    assert(target instanceof Address)
    assert(target.isRemote())
    assert(source instanceof Address)
    assert(source.isRemote())
    assert(pulse instanceof Pulse)
    debug(`interpulse hint received`, target, source)

    const tracker = { source, pulse }
    const promise = new Promise((resolve, reject) => {
      Object.assign(tracker, { resolve, reject })
    })
    const chainId = target.getChainId()
    if (this.#interpulseLocks.has(chainId)) {
      const queue = this.#interpulseLocks.get(chainId)
      queue.push(tracker)
      debug(`interpulse buffered`, queue.length)
      return promise
    }
    const queue = [tracker]
    this.#interpulseLocks.set(chainId, queue)
    const lock = await this.#crypto.lock(target)
    const [pool, resolver] = await this.#interpulseQueue(lock, queue, target)
    assert(!queue.length)
    this.#interpulseLocks.delete(chainId)
    const result = await this.#increase(pool, lock)
    resolver(result)
    return promise
  }
  async #interpulseQueue(lock, interpulseQueue, target) {
    assert(lock instanceof CryptoLock)
    assert(lock.isValid())
    assert(Array.isArray(interpulseQueue))
    assert(target instanceof Address)

    let pool
    const resolves = []
    while (interpulseQueue.length) {
      const { source, pulse, resolve, reject } = interpulseQueue.shift()
      resolves.push(resolve)
      const interpulse = Interpulse.extract(pulse, target)
      // TODO check that the change we want to make is still valid
      if (interpulse.tx.isGenesisRequest()) {
        const installer = interpulse.tx.getGenesisInstaller()
        const genesis = await pulse.deriveChildGenesis(installer)
        await this.#endurance.endure(genesis)
        debug(`genesis endured`, genesis.getAddress())
        // TODO ? make a unified way to fetch the latest pool item ?
        // pools are always processed as soon as they are modified
        assert(!pool)
      }
      if (!pool) {
        const latest = await this.#endurance.findLatest(target)
        const parent = latest.isGenesis() ? pulse : undefined
        pool = await latest.generateSoftPulse(parent)
      }
      pool = await pool.ingestInterpulse(interpulse)
      debug(`interpulse ingested for: %s from: %s`, target, source)
    }
    const resolver = (result) => resolves.forEach((resolve) => resolve(result))
    return [pool, resolver]
  }
  async #increase(pool, lock) {
    assert(pool instanceof Pulse)
    assert(pool.getNetwork().channels.rxs.length)
    assert(lock instanceof CryptoLock)
    assert(lock.isValid())
    await this.#scale.watchdog(pool)

    pool = await this.#reducer(pool)
    const resolver = this.#endurance.getResolver(pool.currentCrush.cid)
    const provenance = await pool.provenance.crushToCid(resolver)
    const signature = await lock.sign(provenance)
    pool = pool.addSignature(lock.publicKey, signature)
    const pulse = await pool.crushToCid(resolver)
    assert(provenance.cid.equals(pulse.provenance.cid))

    await this.#endurance.endure(pulse)
    // TODO update all the subscriptions
    await lock.release()
    await this.#transmit(pulse)
  }
  async #reducer(pool) {
    assert(pool instanceof Pulse)
    assert(pool.isModified())
    const timeout = 2000 // TODO move to config
    const isolate = await this.#isolate.load(pool, timeout)
    const latest = (path) => this.latestByPath(path)
    return reducer(pool, isolate, latest)
  }
  async latestByPath(path, rootAddress = this.selfAddress) {
    // TODO allow remote roots
    assert.strictEqual(typeof path, 'string')
    assert(posix.isAbsolute(path), `path not absolute: ${path}`)
    assert(rootAddress instanceof Address, `no root for path: ${path}`)
    debug('latestByPath', path)
    if (this.#isolate.isCovenant(path)) {
      return this.#isolate.getCovenantPulse(path)
    }

    // get the root pulse
    let latest = await this.#endurance.findLatest(rootAddress)
    assert(latest instanceof Pulse)
    if (path === '/') {
      return latest
    }
    const [, ...segments] = path.split('/') // discard the root
    const depth = ['/']
    while (segments.length) {
      const segment = segments.shift()
      depth.push(segment)
      const network = latest.getNetwork()
      if (!(await network.hasChannel(segment))) {
        const merged = depth.join('/').substring(1)
        throw new Error(`Segment not present: ${merged} of: ${path}`)
      }
      const channel = await network.getChannel(segment)
      const { address } = channel
      if (!address.isRemote()) {
        throw new Error(`segment not resolved: ${segment} of: ${path}`)
      }
      // TODO approot walk should use the precedent only
      latest = await this.#endurance.findLatest(address)
    }
    return latest
  }
  async #transmit(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const network = pulse.getNetwork()
    const awaits = network.channels.txs.map(async (channelId) => {
      const channel = await network.channels.getChannel(channelId)
      const { address } = channel
      assert(address.isRemote())
      const target = address
      const source = pulse.getAddress()
      if (this.isLocal(address)) {
        // remote validators will receive new block proposals as announcements
        return await this.#interpulse(target, source, pulse)
      } else {
        this.#endurance.announceInterpulse(target, source, pulse)
      }
    })
    await Promise.all(awaits)
    if (pulse.getAddress().equals(this.selfAddress)) {
      const io = await network.getIo()
      await this.#checkPierceTracker(io, this.selfAddress)
    }
  }
  isLocal(address) {
    // find out if we are the validator or not
    return true // TODO fetch the pulse validators only, then check
    // validators check is acceptable for ours or remote
  }
  subscribe(callback) {
    assert.strictEqual(typeof callback, 'function')
    // TODO gets called each time a new block is made
  }
  #pierceLocks = new Map()
  async pierce(request, address = this.selfAddress) {
    // the origin of external stimulus across all engines
    // return a promise that resolves when the promise returns AND
    // the engine has settled
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(request instanceof Request)
    debug(`pierce`, request.type, address)
    const chainId = address.getChainId()
    const tracker = { request, requestId: undefined }
    const promise = new Promise((resolve, reject) =>
      Object.assign(tracker, { resolve, reject })
    )
    if (this.#pierceLocks.has(chainId)) {
      const pierceQueue = this.#pierceLocks.get(chainId)
      pierceQueue.push(tracker)
      // TODO somehow unify with interpulse buffering by making
      // pierce look like an interpulse hint
      return promise
    }
    const pierceQueue = [tracker]
    this.#pierceLocks.set(chainId, pierceQueue)

    const lock = await this.#crypto.lock(address)
    // could get the pool and pass it around with the lock ?
    // the engines work is to make sure pool is increased into a pulse
    // it cannot settle while there is unincreased pool around

    const latest = await this.#endurance.findLatest(address)
    assert(latest instanceof Pulse)
    assert(latest.isVerified())
    let pool = await latest.generateSoftPulse()
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
    await this.#increase(pool, lock)
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
    assert(address.equals(this.selfAddress))
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
  async stop() {
    // TODO wait on any outstanding pulses to be reduced down
    // maybe make pool be a Set that always gets drained
    // reject any new calls to interpulse in the meantime
    // ? shut down endurance ?
  }
}
