import assert from 'assert-fast'
import posix from 'path-browserify'
import { pushable } from 'it-pushable'
import {
  Network,
  Address,
  Pulse,
  Request,
  Interpulse,
  Channel,
  Validators,
  PulseLink,
} from '../../w008-ipld/index.mjs'
import { reducer } from './reducer'
import { Isolate } from './Isolate'
import { Scale } from './Scale'
import { Crypto, CryptoLock } from './Crypto'
import { Endurance } from './Endurance'
import { Deepening } from './Deepening'
import Debug from 'debug'
const debug = Debug('interpulse:Engine')

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

  #subscribers = new Set()

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
      prioritizeUpdates(queue)
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
          // TODO verify update is actually what comes next
          const { pulse } = payload
          let network = pool.getNetwork()
          let channel = await network.getByAddress(pulse.getAddress())
          if (channel.isSubscription) {
            // TODO test subscriptions actually work
            const prior = channel.rx.latest
            const update = Request.createTreeUpdate(prior, pulse.getPulseLink())
            const loopback = await network.getLoopback()
            network = await network.setLoopback(loopback.txRequest(update))
          }
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
    assert(latest.isVerified())
    assert(this.#crypto.isValidatable(latest), 'No public keys for Pulse')
    if (latest.isForkGenesis()) {
      assert(deepening.type === Deepening.INTERPULSE)
      parent = deepening.payload.pulse
    }
    assert(!parent || latest.isGenesis())
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
    if (pool.getNetwork().channels.cxs) {
      // cxs is a transient variable
      pool = await this.#updateTree(pool)
      assert(!pool.getNetwork().channels.cxs)
    }
    if (pool.getNetwork().channels.txs.length) {
      pool = await this.#fork(pool)
    }
    const resolver = this.#endurance.getResolver(pool.currentCrush.cid)
    const provenance = await pool.provenance.crushToCid(resolver)
    const signature = await lock.sign(provenance)
    pool = pool.addSignature(lock.publicKey, signature)
    const pulse = await pool.crushToCid(resolver)
    assert(provenance.cid.equals(pulse.provenance.cid))

    await this.#endurance.endure(pulse)
    this.#notifySubscribers(pulse) // TODO move pierce tracker to a subscriber
    await lock.release()
    debug('lock released', pool.getAddress())
    await this.#transmit(pulse)
  }
  async #fork(pool) {
    const forkDebug = debug.extend('fork')
    assert(pool instanceof Pulse)
    assert(pool.isModified())
    assert(pool.currentCrush)

    let { channels } = pool.getNetwork()
    const { txs } = channels
    assert(Array.isArray(txs))
    assert(txs.length)
    for (const channelId of txs) {
      let channel = await channels.getChannel(channelId)
      if (!channel.rx.latest) {
        continue
      }
      const child = await this.#endurance.recover(channel.rx.latest)
      assert(child instanceof Pulse)
      const parent = await child.getNetwork().getParent()
      forkDebug('parentAddress', parent.address)
      forkDebug('pool address', pool.getAddress())
      const isNestedFork = !parent.address.equals(pool.getAddress())
      if (!channel.isForkPoint() && !isNestedFork) {
        continue
      }
      forkDebug(`fork: ${channel.address} parent points to ${parent.address}`)
      const resolver = this.#endurance.getResolver(child.cid)
      const fork = await child.deriveForkGenesis(pool, resolver)
      assert(!child.getAddress().equals(fork.getAddress()))
      assert(fork.isGenesis())
      await this.#endurance.endure(fork)
      const forkAddress = fork.getAddress()
      const forkLatest = fork.getPulseLink()
      const precedent = pool.currentCrush.getPulseLink()
      channel = channel.forkDown(forkAddress, forkLatest, precedent)
      channels = await channels.updateChannel(channel)
    }
    pool = pool.setNetwork(pool.getNetwork().setMap({ channels }))
    return pool
  }
  async #reducer(pool) {
    assert(pool instanceof Pulse)
    assert(pool.isModified())
    const timeout = 2000 // TODO move to config
    const isolate = await this.#isolate.load(pool, timeout)
    let rootPulse = this.selfLatest
    if (await pool.isRoot()) {
      rootPulse = pool
    }
    const latest = async (pathOrPulseLink, startingPulse = rootPulse) => {
      assert(startingPulse instanceof Pulse)
      if (typeof pathOrPulseLink === 'string') {
        pathOrPulseLink = posix.normalize(pathOrPulseLink)
        return await this.latestByPath(pathOrPulseLink, startingPulse)
      } else {
        assert(pathOrPulseLink instanceof PulseLink, 'not string or PulseLink')
        const child = await this.#endurance.recover(pathOrPulseLink)
        assert(child instanceof Pulse)
        return child
      }
    }
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
  async updateLatest(target, latest) {
    assert(target instanceof Address)
    assert(target.isRemote())
    assert(latest instanceof Pulse)
    assert(latest.isVerified())
    const deepening = Deepening.createUpdate(target, latest)
    return await this.#pool(deepening)
  }
  async latestByPath(path, rootPulse) {
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
    path = posix.normalize(path)
    const segments = split(path)
    const depth = ['/']
    while (segments.length) {
      const segment = segments.shift()
      depth.push(segment)
      const network = pulse.getNetwork()
      if (!(await network.hasChannel(segment))) {
        const merged = depth.join('/').substring('/'.length)
        throw new Error(`Segment not present: ${merged} of: ${path}`)
      }
      const isSymlink = await network.isSymlink(segment)
      if (isSymlink) {
        const resolved = await network.resolveSymlink(segment)
        assert(posix.isAbsolute(resolved), 'symlinks must be absolute for now')
        return this.latestByPath(resolved + segments.join('/'), rootPulse)
      }
      const channel = await network.getChannel(segment)
      const { address } = channel
      if (!address.isRemote() && !channel.isForkPoint()) {
        throw new Error(`Segment not resolved: ${segment} of: ${path}`)
      }
      const { latest } = channel.rx
      if (!latest) {
        const rootAddress = rootPulse.getAddress()
        throw Error(
          `No latest for ${address} relative to ${rootAddress} in path: ${path} at segment: ${segment}`
        )
      }
      assert(latest instanceof PulseLink)
      pulse = await this.#endurance.recover(latest)
      const pulseAddress = pulse.getAddress()
      assert(channel.isForkPoint() || pulseAddress.equals(address))
      this.#endurance.discoverLatest(pulseAddress, latest)
    }
    return pulse
  }
  subscribe() {
    const sink = pushable({
      objectMode: true,
      onEnd: () => {
        debug('unsubscribe')
        this.#subscribers.delete(sink)
      },
    })
    this.#subscribers.add(sink)
    sink.push(this.selfLatest)
    return sink
  }
  #notifySubscribers(pulse) {
    assert(pulse instanceof Pulse)
    if (pulse.getAddress().equals(this.selfAddress)) {
      debug('notifying root subscribers:', pulse.getPulseLink())
      for (const sink of this.#subscribers) {
        sink.push(pulse)
      }
    }
  }
  async #transmit(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const network = pulse.getNetwork()
    const updateParent = this.#updateParent(pulse)
    const awaits = network.channels.txs.map(async (channelId) => {
      const channel = await network.channels.getChannel(channelId)
      const { address: target } = channel
      assert(target.isRemote())
      if (await this.#isLocal(channel, pulse)) {
        // remote validators will receive new block proposals as announcements
        return await this.#interpulse(target, pulse)
      } else {
        // TODO this seems broken - how are updates being broadcast ?
        this.#endurance.announceInterpulse(target, pulse)
      }
    })
    awaits.unshift(updateParent)
    await Promise.all(awaits)
    if (pulse.getAddress().equals(this.selfAddress)) {
      const io = await network.getIo()
      this.#checkPierceTracker(io, this.selfAddress)
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
  async whoami(pulse) {
    assert(pulse instanceof Pulse)
  }
  async #isLocal(toChannel, fromPulse) {
    assert(toChannel instanceof Channel)
    assert(fromPulse instanceof Pulse)
    // if its a hardlink, get the total path
    // based on path alone, we can tell if this channel is remote ?

    const fromPath = await this.whoami(fromPulse)

    // get the path of the address
    // use the path to determine local or remote

    /**
     * How would we know if this address is local or remote ?
     * If we had the alias info, then we could figure this part out.
     * But we would need to enforce pathing
     * So uplinks cannot be pure addresses - need to be pathed
     *
     */
    // find out if we are the validator or not
    return true // TODO fetch the pulse validators only, then check
    // validators check is acceptable for ours or remote
  }
  async pierce(request, address = this.selfAddress) {
    assert(address instanceof Address)
    assert(address.isRemote())
    if (!(request instanceof Request)) {
      assert(request instanceof Object)
      request = Request.create(request)
    }
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
  #checkPierceTracker(io, address) {
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
    for (const sink of this.#subscribers) {
      sink.end()
    }
    while (this.#poolBuffers.size) {
      for (const cycle of this.#poolBuffers.values()) {
        await cycle.promise
      }
    }
  }
}
const split = (path) => {
  assert.strictEqual(typeof path, 'string')
  const result = path.split('/')
  while (result[0] === '') {
    result.shift()
  }
  while (result[result.length - 1] === '') {
    result.pop()
  }
  return result
}
const prioritizeUpdates = (queue) => {
  queue.sort((a, b) => {
    const aU = a.type === Deepening.UPDATE ? 1 : 0
    const bU = b.type === Deepening.UPDATE ? 1 : 0
    return aU - bU
  })
}
