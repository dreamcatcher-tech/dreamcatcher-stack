import assert from 'assert-fast'
import * as IPFS from 'ipfs-core'
import { Key } from 'interface-datastore'
import posix from 'path-browserify'
import {
  Network,
  Address,
  Pulse,
  PulseLink,
  Request,
  Interpulse,
  Channel,
  Keypair,
  Validators,
} from '../../w008-ipld'
import { reducer } from './reducer'
import { Isolate } from './Isolate'
import { Scale } from './Scale'
import { Crypto, CryptoLock } from './Crypto'
import { Endurance } from './Endurance'
import { Hints } from './Hints'
import * as system from '../../w212-system-covenants'
import config from 'ipfs-core-config/config'
import Debug from 'debug'
const debug = Debug('interblock:engine')
const rootRepoKey = new Key('latest')

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
  #repo
  #address // the address of the base chain of this engine
  #latest // latest block in the base chain of this engine

  #overloads = {}
  #overloadPulses = new Map()

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
  get ipfs() {
    return this.#endurance.ipfs
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
    await instance.#init(CI, opts.repo)
    return instance
  }
  constructor({ isolate, crypto, endurance, scale, hints } = {}) {
    // Aim to remove the interdependencies between services by marshalling
    // through the engine.
    this.#isolate = isolate || new Isolate()
    this.#crypto = crypto || new Crypto()
    this.#endurance = endurance || new Endurance()
    this.#scale = scale || new Scale()
    this.#hints = hints || new Hints()
  }
  overload(overloads) {
    assert.strictEqual(typeof overloads, 'object')
    this.#overloads = overloads
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
  async #init(CI, repo) {
    if (repo) {
      // means you want some persistence, which means keys need to persist
      // so start the full ipfs in offline mode
      this.#repo = repo
      const options = { repo, init: { emptyRepo: true }, start: false }
      let latest
      if (!(await repo.isInitialized())) {
        // workaround while waiting for
        // https://github.com/ipfs/js-ipfs/pull/4172
        let keypair
        if (CI) {
          keypair = Keypair.createCI()
        } else {
          keypair = await Keypair.generate('ipex')
        }
        options.init.privateKey = await keypair.generatePeerId()
        const validators = Validators.create([keypair.publicKey])
        latest = await Pulse.createRoot({ CI, validators })
      }
      debug(`startingipfs....`)
      options.config = config()
      options.preload = false
      const ipfs = await IPFS.create(options)
      debug(`ipfs created`)
      this.#endurance.setIpfs(ipfs)
      if (latest) {
        this.#latest = latest
        const [ipfsFlushed] = await this.#endurance.endure(this.#latest)
        this.#updateRoot(ipfsFlushed, this.#latest)
      } else {
        const cidString = await repo.root.get(rootRepoKey)
        const pulseLink = PulseLink.parse(cidString)
        this.#latest = await this.#endurance.recover(pulseLink)
        // TODO verify we have the keys required for it
      }

      // TODO recover subscriptions
      // subscriptions should be written to ipfs somehow
      // store them in the latest block representing this engine ?
      // TODO verify we have the crypto keys required to be this block
    } else {
      // we are in total CI mode using no ipfs
      this.#latest = await Pulse.createRoot({ CI })
      await this.#endurance.endure(this.#latest)
    }
    assert(this.#latest instanceof Pulse)
    // endure so the cache is warmed up
    this.#hints.poolSubscribe((address) => {
      assert(address instanceof Address)
      debug(`poolSubscribe`, address)
    })
    this.#hints.interpulseSubscribe((target, source, pulselink) => {
      debug(`interpulseSubscribe`)
    })
    this.#hints.pulseSubscribe((pulse) => {
      assert(pulse instanceof Pulse)
      const address = pulse.getAddress()
      debug(`pulseSubscribe`, address)
      // TODO recalculate the pool, store this pulse
    })
    this.#address = this.#latest.getAddress()
    await this.#hints.pulseAnnounce(this.#latest)
  }
  async #updateRoot(ipfsFlushed, latest) {
    if (!this.#repo) {
      return
    }
    assert.strictEqual(typeof ipfsFlushed.then, 'function')
    assert(latest instanceof Pulse)
    if (this.#repo) {
      await ipfsFlushed
      const cidString = latest.cid.toString()
      await this.#repo.root.put(rootRepoKey, cidString)
      console.info(`https://explore.ipld.io/#/explore/${cidString}`)
    }
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
    await this.#hints.poolAnnounce(pool)
    const result = await this.#increase(pool, lock)
    resolver(result)
    return promise
  }
  async #interpulseQueue(lock, interpulseQueue, target) {
    assert(lock instanceof CryptoLock)
    assert(lock.isValid())
    assert(Array.isArray(interpulseQueue))

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
        await this.#hints.pulseAnnounce(genesis)
        debug(`genesis endured`, genesis.getAddress())
        // TODO ? make a unified way to fetch the latest pool item ?
        // pools are always processed as soon as they are modified
        assert(!pool)
        pool = await genesis.generateSoftPulse(pulse)
      }
      if (!pool) {
        pool = await this.#hints.poolLatest(target)
        if (pool) {
          assert(pool instanceof Pulse)
        } else {
          const pulselink = await this.#hints.pulseLatest(target)
          debug(`using latest`, pulselink)
          const pulse = await this.#endurance.recover(pulselink)
          pool = await pulse.generateSoftPulse()
        }
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
    const resolver = this.#endurance.getResolver()
    const provenance = await pool.provenance.crushToCid(resolver)
    const signature = await lock.sign(provenance)
    pool = pool.addSignature(lock.publicKey, signature)
    const pulse = await pool.crushToCid(resolver)
    assert(provenance.cid.equals(pulse.provenance.cid))

    const [ipfsFlushed] = await this.#endurance.endure(pulse)
    if (pulse.getAddress().equals(this.address)) {
      this.#latest = pulse
      this.#updateRoot(ipfsFlushed, pulse)
    }
    await this.#hints.pulseAnnounce(pulse)
    await this.#hints.softRemove(pulse.getAddress())
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
  async latestByPath(path, rootAddress = this.#latest.getAddress()) {
    // TODO allow remote roots
    assert.strictEqual(typeof path, 'string')
    assert(posix.isAbsolute(path), `path not absolute: ${path}`)
    assert(rootAddress instanceof Address, `no root for path: ${path}`)
    debug('latestByPath', path)
    if (this.#overloads[path]) {
      if (!this.#overloadPulses.has(path)) {
        const covenant = this.#overloads[path]
        const pulse = await Pulse.createCovenantOverload(covenant)
        this.#overloadPulses.set(path, pulse)
      }
      return this.#overloadPulses.get(path)
    }
    if (path.startsWith('/system:/')) {
      const systemName = path.substring('/system:/'.length)
      assert(system[systemName], `unknown system covenant: ${systemName}`)
      if (!this.#overloadPulses.has(path)) {
        const covenant = system[systemName]
        const pulse = await Pulse.createCovenantOverload(covenant)
        this.#overloadPulses.set(path, pulse)
      }
      return this.#overloadPulses.get(path)
    }

    // get the root pulse
    let latestPulselink = await this.#hints.pulseLatest(rootAddress)
    assert(latestPulselink instanceof PulseLink)
    let latest = await this.#endurance.recover(latestPulselink)
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
      latestPulselink = await this.#hints.pulseLatest(address)
      latest = await this.#endurance.recover(latestPulselink)
    }
    return latest
  }
  async #transmit(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const network = pulse.getNetwork()
    const awaits = []
    for (const channelId of network.channels.txs) {
      const channel = await network.channels.getChannel(channelId)
      const { address } = channel
      assert(address.isRemote())
      const target = address
      const source = pulse.getAddress()
      this.#hints.interpulseAnnounce(target, source, pulse)
      // TODO check if we are the validator, else rely on announce
      awaits.push(this.#interpulse(target, source, pulse))
    }
    await Promise.all(awaits)
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
      // TODO somehow unify with interpulse buffering by making
      // pierce look like an interpulse hint
      return promise
    }
    const pierceQueue = [tracker]
    this.#pierceLocks.set(chainId, pierceQueue)

    const lock = await this.#crypto.lock(address)

    // get the latest softpulse from the dht
    // repeatedly attempt to insert the pierce
    let pulselink = await this.#hints.poolLatest(address)
    if (!pulselink) {
      // pool should be stored in the repo raw
      pulselink = await this.#hints.pulseLatest(address)
    }
    assert(pulselink instanceof PulseLink, `No chain found: ${address}`)
    let pool = await this.#endurance.recover(pulselink)
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
  async ipfsStart(privateNetworkKey) {
    return await this.#endurance.ipfsStart()
  }
  async ipfsStop() {
    return await this.#endurance.ipfsStop()
  }
}
