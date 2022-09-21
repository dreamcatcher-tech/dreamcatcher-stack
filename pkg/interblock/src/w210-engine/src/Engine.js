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
  PulseLink,
} from '../../w008-ipld'
import { reducer } from './reducer'
import { Isolate } from './Isolate'
import { Scale } from './Scale'
import { Crypto, CryptoLock } from './Crypto'
import { Endurance } from './Endurance'
import { Deepening } from './Deepening'
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
  async #interpulse(target, pulse) {
    assert(target instanceof Address)
    assert(pulse instanceof Pulse)
    debug(
      `interpulse for %s from %s pulselink %s`,
      target,
      pulse.getAddress(),
      pulse.getPulseLink()
    )

    const deepening = Deepening.createInterpulse(target, pulse)
    return await this.#pool(deepening)
  }
  #poolBuffers = new Map() // chainId: deepening[]
  async #pool(deepening) {
    assert(deepening instanceof Deepening)
    if (this.#poolBuffers.has(deepening.chainId)) {
      const { queue, promise } = this.#poolBuffers.get(deepening.chainId)
      queue.push(deepening)
      return promise
    }
    return await this.#drainPoolBuffer(deepening)
  }
  async #drainPoolBuffer(first) {
    assert(first instanceof Deepening)
    assert(!this.#poolBuffers.has(first.chainId))
    const queue = [first]
    const cycle = { queue }
    cycle.promise = new Promise((resolve, reject) =>
      Object.assign(cycle, { resolve, reject })
    )
    const { chainId } = first
    this.#poolBuffers.set(chainId, cycle)
    const lock = await this.#crypto.lock(first.address)
    debug('got lock for', first.address)
    const pool = await this.#deepenPool(queue)
    assert(!queue.length)
    this.#poolBuffers.delete(chainId)

    const result = await this.#increase(pool, lock)
    assert(!lock.isValid(), 'increase did not release lock')
    cycle.resolve(result)
    return result
  }
  async #deepenPool(queue) {
    assert(Array.isArray(queue))
    assert(queue.length > 0)
    const [first] = queue
    assert(queue.every(({ chainId }) => first.chainId === chainId))
    const { address } = first
    let pool = await this.#generatePool(first)
    while (queue.length) {
      const { type, payload } = queue.shift()
      debug('deepening %s for %s', type, address)
      switch (type) {
        case Deepening.INTERPULSE: {
          const interpulse = Interpulse.extract(payload.pulse, address)
          pool = await pool.ingestInterpulse(interpulse)
          break
        }
        case Deepening.PIERCE: {
          const { dmz } = pool.provenance
          assert(dmz.config.isPierced, `Attempt to pierce unpierced chain`)
          const { piercer, request } = payload
          const [network, requestId] = await pool.getNetwork().pierceIo(request)
          pool = pool.setNetwork(network)
          piercer.requestId = requestId
          break
        }
        case Deepening.UPDATE: {
          const { pulse } = payload
          let network = pool.getNetwork()
          let channel = await network.getByAddress(pulse.getAddress())
          channel = channel.addLatest(pulse.getPulseLink())
          network = await network.updateChannel(channel)
          pool = pool.setNetwork(network)
          break
        }
      }
    }
    debug('deepenPool complete', address)
    return pool
  }
  async #generatePool(deepening) {
    assert(deepening instanceof Deepening)
    let parent
    if (deepening.type === Deepening.INTERPULSE) {
      const { pulse } = deepening.payload
      const interpulse = Interpulse.extract(pulse, deepening.address)
      if (interpulse.tx.isGenesisRequest()) {
        const installer = interpulse.tx.getGenesisInstaller()
        parent = pulse
        const genesis = await parent.deriveChildGenesis(installer)
        await this.#endurance.endure(genesis)
        debug(`genesis endured`, genesis.getAddress())
      }
    }
    const { address } = deepening
    let latest
    if (this.#endurance.hasLatest(address)) {
      latest = await this.#endurance.findLatest(address)
      debug('endurance had', address)
    } else {
      debug('endurance no cache for', address)
      const source = deepening.payload.pulse
      assert(source instanceof Pulse)
      const channel = await source.getNetwork().getByAddress(address)
      // TODO make aliases discern between child and symlink aliases
      const [alias] = channel.aliases
      assert.strictEqual(typeof alias, 'string')
      assert(alias)

      debug('latest by alias', alias)
      latest = await this.latestByPath('/' + alias, source)
    }
    assert(latest instanceof Pulse, `no latest found for ${address}`)
    if (parent) {
      assert(latest.isGenesis())
    }
    assert(latest.isVerified())
    return await latest.generateSoftPulse(parent)
  }
  async #increase(pool, lock) {
    assert(pool instanceof Pulse)
    assert(lock instanceof CryptoLock)
    assert(lock.isValid())
    const { channels } = pool.getNetwork()
    assert(channels.rxs.length || channels.cxs.length, 'nothing to increase')
    await this.#scale.watchdog(pool)
    if (channels.rxs.length) {
      pool = await this.#reducer(pool)
    }
    if (channels.cxs) {
      pool = await this.#updateTree(pool)
      assert(!pool.getNetwork().channels.cxs)
    }
    const resolver = this.#endurance.getResolver(pool.currentCrush.cid)
    const provenance = await pool.provenance.crushToCid(resolver)
    const signature = await lock.sign(provenance)
    pool = pool.addSignature(lock.publicKey, signature)
    const pulse = await pool.crushToCid(resolver)
    assert(provenance.cid.equals(pulse.provenance.cid))

    await this.#endurance.endure(pulse)
    await lock.release()
    debug('lock released', pool.getAddress())
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
  async #updateTree(pool) {
    assert(pool instanceof Pulse)
    assert(pool.isModified())
    let network = pool.getNetwork()
    const { cxs } = network.channels
    assert(Array.isArray(cxs))
    assert(cxs.length)
    for (const channelId of cxs) {
      const channel = await network.channels.getChannel(channelId)
      assert(channel.rx.latest instanceof PulseLink)
      const latest = await this.#endurance.recover(channel.rx.latest)
      assert(latest instanceof Pulse)
      // TODO update the trees
    }
    const channels = await network.channels.delete('cxs')
    network = network.setMap({ channels })
    pool = pool.setNetwork(network)
    return pool
  }
  async latestByPath(path, rootPulse) {
    // TODO allow remote rootAddresses
    assert.strictEqual(typeof path, 'string')
    if (!rootPulse) {
      rootPulse = this.selfLatest
    }
    assert(rootPulse instanceof Pulse, `no root for path: ${path}`)
    debug('latestByPath', path)
    if (this.#isolate.isCovenant(path)) {
      return this.#isolate.getCovenantPulse(path)
    }

    let pulse = rootPulse
    assert(pulse instanceof Pulse)
    if (path === '/') {
      return pulse
    }
    const [discardRoot, ...segments] = path.split('/')
    const depth = ['/']
    while (segments.length) {
      const segment = segments.shift()
      depth.push(segment)
      const network = pulse.getNetwork()
      if (!(await network.hasChannel(segment))) {
        const merged = depth.join('/').substring(1)
        throw new Error(`Segment not present: ${merged} of: ${path}`)
      }
      const channel = await network.getChannel(segment)
      const { address } = channel
      if (!address.isRemote()) {
        throw new Error(`Segment not resolved: ${segment} of: ${path}`)
      }

      const { latest } = channel.rx
      if (!latest) {
        const rootAddress = rootPulse.getAddress()
        throw Error(`No latest for ${address} relative to ${rootAddress}`)
      }
      assert(latest instanceof PulseLink)
      pulse = await this.#endurance.recover(latest)
      this.#endurance.upsertLatest(address, latest)
    }
    return pulse
  }
  async #transmit(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const network = pulse.getNetwork()
    const awaits = network.channels.txs.map(async (channelId) => {
      const channel = await network.channels.getChannel(channelId)
      const { address: target } = channel
      assert(target.isRemote())
      if (this.#isLocal(target)) {
        // remote validators will receive new block proposals as announcements
        return await this.#interpulse(target, pulse)
      } else {
        this.#endurance.announceInterpulse(target, pulse)
      }
    })
    await this.#updateParent(pulse)
    await Promise.all(awaits)
    if (pulse.getAddress().equals(this.selfAddress)) {
      const io = await network.getIo()
      await this.#checkPierceTracker(io, this.selfAddress)
    }
    debug('transmit complete', pulse.getAddress(), pulse.getPulseLink())
  }
  async #updateParent(pulse) {
    assert(pulse instanceof Pulse)
    if (await pulse.isRoot()) {
      debug('no update parent for root')
      return
    }
    const { address } = await pulse.getNetwork().getParent()
    debug('updateParent', address)
    const deepening = Deepening.createUpdate(address, pulse)
    return await this.#pool(deepening)
  }
  #isLocal(address) {
    // find out if we are the validator or not
    return true // TODO fetch the pulse validators only, then check
    // validators check is acceptable for ours or remote
  }
  async pierce(request, address = this.selfAddress) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(request instanceof Request)
    debug(`pierce`, request.type, address)

    const piercer = {}
    const promise = new Promise((resolve, reject) =>
      Object.assign(piercer, { resolve, reject })
    )
    this.#piercers.add(piercer)
    const deepening = Deepening.createPierce(address, request, piercer)
    await this.#pool(deepening)
    return promise
  }
  #piercers = new Set()
  async #checkPierceTracker(io, address) {
    assert(io instanceof Channel)
    assert.strictEqual(io.channelId, Network.FIXED_IDS.IO)
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(address.equals(this.selfAddress))
    const { tx } = io
    if (!tx.isEmpty()) {
      for (const piercer of this.#piercers) {
        if (!piercer.requestId) {
          continue
        }
        const { stream, requestIndex } = piercer.requestId
        debug(piercer)
        // see if the replies contain a settle
        if (tx[stream].hasReply(requestIndex)) {
          const reply = tx[stream].getReply(requestIndex)
          debug('tracker match', reply.type)
          if (reply.isPromise()) {
            continue
          }
          this.#piercers.delete(piercer)
          if (reply.isResolve()) {
            piercer.resolve(reply.payload)
          } else {
            assert(reply.isRejection())
            piercer.reject(reply.getRejectionError())
          }
        }
      }
    }
  }
  async multiThreadStart(threadCount) {}
  async multiThreadStop() {}
  async stop() {
    // TODO reject calls to a stopped engine
    while (this.#poolBuffers.size) {
      for (const cycle of this.#poolBuffers.values) {
        await cycle.promise
      }
    }
  }
}
