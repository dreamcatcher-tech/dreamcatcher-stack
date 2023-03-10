import { pipe } from 'it-pipe'
import bytes from 'pretty-bytes'
import { CID } from 'multiformats/cid'
import { eventLoopSpinner } from 'event-loop-spinner'
import {
  Interpulse,
  Address,
  decode,
  PulseLink,
  Channel,
  Pulse,
} from '../../w008-ipld/index.mjs'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
import { PulseNet } from '..'
import { Lifter } from './Lifter'
import Debug from 'debug'
import { pushable } from 'it-pushable'
const debug = Debug('interblock:interpulse:NetEndurance')

export class NetEndurance extends Endurance {
  static async create(pulseNet) {
    assert(pulseNet instanceof PulseNet)
    const instance = new NetEndurance()
    instance.#net = pulseNet
    await instance.#start()
    return instance
  }
  #net
  #writePromise = Promise.resolve()
  #writeResolve
  #writeCount = 0
  #writeStart() {
    if (!this.#writeCount) {
      this.#writePromise = new Promise((resolve) => {
        this.#writeResolve = resolve
      })
    }
    this.#writeCount++
  }
  #writeStop() {
    this.#writeCount--
    if (!this.#writeCount) {
      this.#writeResolve()
      this.#writeResolve = undefined
      this.#writePromise = Promise.resolve()
    }
  }
  async #start() {
    // TODO retransmit the tx's of latest pulse
    const { repo } = this.#net
    assert(!repo.closed)
    const config = await repo.config.getAll()
    if (config.latest) {
      const pulselink = PulseLink.parse(config.latest)
      const latest = await this.recover(pulselink)
      await super.endure(latest) // acts like the bootstrap pulse
    }
    this.#net.uglyInjection(this)
  }
  #blockSetPromises = new Map() // cid -> promise<Set<cid>>
  async streamWalk(stream, pulse, prior, type) {
    assert.strictEqual(typeof stream.push, 'function')
    assert(pulse instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type], `invalid recovery type ${type}`)

    debug(`streamWalk ${pulse} ${prior} ${type}`)
    const start = Date.now()

    const types = Lifter.RECOVERY_TYPES
    const withChildren = [types.deepPulse, types.crispDeepPulse].includes(
      types[type]
    )
    const noHamts = [types.pulse, types.interpulse].includes(types[type])

    // TODO cache by pulse cid rather than whole tree, for child reuse
    let priorSet = new Set()
    let isPulseCached = false

    const all = pushable({ objectMode: true })
    let length = 0
    let hashLength = 0
    let blockCount = 0
    pipe(all, async (source) => {
      for await (const block of source) {
        const cidString = block.cid.toString()
        if (!priorSet.has(cidString)) {
          length += block.bytes.length
          hashLength += block.cid.bytes.length
          blockCount++
          stream.push(block)
        }
      }
      debug('streamWalk ended')
    })

    if (prior) {
      const cacheKey = `${prior.cid.toString()}-${withChildren}-${noHamts}`
      if (!this.#blockSetPromises.has(cacheKey)) {
        const { promise, resolve } = flippedPromise()
        this.#blockSetPromises.set(cacheKey, promise)
        // TODO start streaming earlier as each pulse is walked
        const set = await this.#blockSetWalk(prior, withChildren, noHamts)
        resolve(set)
      }
      priorSet = await this.#blockSetPromises.get(cacheKey)
    }

    const cacheKey = `${pulse.cid.toString()}-${withChildren}-${noHamts}`
    if (!this.#blockSetPromises.has(cacheKey)) {
      const { promise, resolve } = flippedPromise()
      this.#blockSetPromises.set(cacheKey, promise)
      // TODO splice into an existing walk to stream partially with catchup
      const set = await this.#blockSetWalk(pulse, withChildren, noHamts, all)
      resolve(set)
    } else {
      isPulseCached = true
      const set = await this.#blockSetPromises.get(cacheKey)
      for (const cidString of set) {
        const localResolver = this.getResolver(pulse.cid)
        if (!priorSet.has(cidString)) {
          const block = await localResolver(CID.parse(cidString))
          all.push(block)
        }
      }
    }
    all.end()

    debug(`lift completed in ${Date.now() - start}ms for ${blockCount} blocks`)
    debug(`with ${bytes(length)} bytes and ${bytes(hashLength)} hashes size`)
    if (priorSet.size) {
      return isPulseCached
    }
    return false
  }

  async #blockSetWalk(pulse, withChildren, noHamts, stream) {
    assert(pulse instanceof PulseLink)
    assert.strictEqual(typeof withChildren, 'boolean')
    assert.strictEqual(typeof noHamts, 'boolean')
    assert(!stream || typeof stream.push === 'function')

    const blocks = new Set()
    const localResolver = this.getResolver(pulse.cid)
    const loggingResolver = async (cid) => {
      const block = await localResolver(cid)
      assert(CID.asCID(block.cid))
      const cidString = block.cid.toString()
      assert(block.value)
      if (blocks.has(cidString)) {
        return block
      }
      blocks.add(cidString)
      if (stream) {
        stream.push(block)
      }
      return block
    }
    const toExport = [pulse]
    while (toExport.length) {
      const pulse = toExport.shift()
      const instance = await Pulse.uncrush(pulse.cid, loggingResolver)
      const network = instance.getNetwork()
      if (!noHamts) {
        await network.walkHamts()
      }
      if (withChildren) {
        for await (const [, channel] of network.channels.list.entries()) {
          if (channel.rx.latest) {
            toExport.push(channel.rx.latest)
          }
        }
      }
    }
    return blocks
  }
  /**
   * @param {PulseLink} pulseLink
   * @returns {Promise<Pulse>}
   */
  async recover(pulseLink, type = 'hamtPulse', abort) {
    assert(pulseLink instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type], `invalid recovery type ${type}`)
    debug('recovering %s type %s', pulseLink, type)

    const cachedResult = await super.recover(pulseLink)
    if (cachedResult) {
      return cachedResult
    }
    const resolver = this.getResolver(pulseLink.cid)
    try {
      const pulse = await Pulse.uncrush(pulseLink.cid, resolver)
      super.cachePulse(pulse)
      return pulse
    } catch (error) {
      debug(`failed to locally recover pulse %s`, pulseLink, error)
      throw error
    }
  }
  async recoverRemote(pulse, prior, abort) {
    assert(pulse instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    this.#net.lift(pulse, prior, 'deepPulse')
    // TODO recover should not require prior knowledge, only lift
    const result = await this.recover(pulse, 'deepPulse', prior)
    return result
  }
  async recoverInterpulse(source, target) {
    assert(source instanceof PulseLink)
    assert(target instanceof Address)
    debug('recovering interpulse from %s targetting %s', source, target)

    // TODO recovery an Interpulse without a full pulse
    await this.#net.lift(source, undefined, 'interpulse')
    const evilFullPulse = await this.recover(source, 'interpulse')
    assert(evilFullPulse instanceof Pulse)
    const interpulse = Interpulse.extract(evilFullPulse, target)
    return interpulse
  }
  async endure(latest) {
    let isBootstrapPulse = !this.selfAddress
    await super.endure(latest)
    this.#writeStart()
    const netEndurePromise = this.#net.endure(latest)
    debug(`start ipfs put`, latest.getPulseLink())
    netEndurePromise
      .then(() => {
        debug(`finish net endure`, latest.getPulseLink())
        this.#writeStop()
      })
      .then(() => this.#transmit(latest))
    if (isBootstrapPulse || this.selfAddress.equals(latest.getAddress())) {
      const pulselink = latest.getPulseLink().cid.toString()
      this.#net.repo.config.set('latest', pulselink)
    }
    return netEndurePromise
  }
  async #transmit(source) {
    assert(source instanceof Pulse)
    assert(source.isVerified())
    const network = source.getNetwork()
    const awaits = network.channels.txs.map(async (channelId) => {
      const channel = await network.channels.getChannel(channelId)
      const { address: target } = channel
      assert(target.isRemote())
      const isLocal = await this.isLocal(channel, source)
      if (!isLocal) {
        const { address, root, path } = await this.#remotePath(channel)
        // TODO handle path changing in mtab
        assert(source instanceof Pulse)
        assert(root instanceof PulseLink)
        assert.strictEqual(typeof path, 'string')
        // root address is so we know what peers to talk to
        // root pulselink is to prove we had a valid path at time of sending
        // path is so the server can recover the latest pulse from its kv store
        // source is to form the interpulse out of
        // target is to know which address to focus the interpulse upon
        debug('transmit', source, target, address, root, path)
        return this.#net.announce(source, target, address, root, path)
      }
    })
    await Promise.all(awaits)
    debug('transmit complete', source.getAddress(), source.getPulseLink())
  }
  async #remotePath(channel) {
    assert(channel instanceof Channel)
    const { address } = channel
    const [alias] = channel.aliases
    if (!alias) {
      const { tip } = channel.rx
      assert(tip, `can only transmit without alias in reply`)
      return { path: '/', root: tip, address }
    }
    if (!alias.includes('/')) {
      // we must be talking to the channel directly
      const root = channel.rx.latest
      return { path: '/', root, address }
    }
    if (alias.startsWith('.mtab/')) {
      const rest = alias.slice('.mtab/'.length)
      const [mtabAlias, ...segments] = rest.split('/')
      const path = '/' + segments.join('/')
      const mtabChannel = await this.selfLatest.getNetwork().getChannel('.mtab')
      const mtab = await this.recover(mtabChannel.rx.latest)
      const hardlink = await mtab.getNetwork().getChannel(mtabAlias)
      const root = hardlink.rx.latest
      const { address } = hardlink
      return { path, root, address }
    }
    channel.dir()
    // if no pathing, then we can get the parent path ?
    throw new Error(`no pathing information found for channel: ${alias}`)
  }
  getResolver(treetop) {
    assert(CID.asCID(treetop))
    const cacheResolver = super.getResolver(treetop)
    const netResolver = this.#getNetResolver(treetop)
    return async (cid) => {
      if (eventLoopSpinner.isStarving()) {
        await eventLoopSpinner.spin()
      }
      const cachedResult = await cacheResolver(cid)
      if (cachedResult) {
        return cachedResult
      }
      // TODO feed into the blockcache with ejection
      const block = await netResolver(cid)
      return block
    }
  }
  #wantList = new Map() // cidString -> promise
  #getNetResolver(treetop) {
    assert(CID.asCID(treetop))
    // TODO WARNING permissions must be honoured
    // TODO use treetop to only fetch things below this CID
    return async (cid, { signal } = {}) => {
      assert(CID.asCID(cid), `not cid: ${cid}`)
      const cidString = cid.toString()
      if (!this.#wantList.has(cidString)) {
        const tracker = {}
        const promise = new Promise((resolve) => {
          tracker.resolve = resolve
        })
        tracker.promise = promise
        this.#wantList.set(cidString, tracker)
        if (await this.#net.repo.blocks.has(cid)) {
          const bytes = await this.#net.repo.blocks.get(cid, { signal })
          const block = await decode(bytes)
          super.cacheBlock(block)
          tracker.resolve(block)
        }
        promise.then(() => this.#wantList.delete(cidString))
      }
      return await this.#wantList.get(cidString).promise
    }
  }
  async pushLiftedBytes(bytes) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin()
    }
    const block = await decode(bytes)
    super.cacheBlock(block)
    const cidString = block.cid.toString()
    if (this.#wantList.has(cidString)) {
      const tracker = this.#wantList.get(cidString)
      tracker.resolve(block)
    }
    // TODO turn this back on once storing to disk
    // await this.#bufferedWrite(block)
    return block
  }
  #queue = []
  async #bufferedWrite(block) {
    this.#queue.push(block)
    if (this.#queue.length === 1) {
      setTimeout(() => {
        const writes = this.#queue.map((block) => ({
          key: block.cid,
          value: block.bytes,
        }))
        this.#net.repo.blocks.putMany(writes)
        this.#queue.length = 0
      }, 500)
    }
  }
  async stop() {
    super.stop()
    await this.#writePromise
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
}
const flippedPromise = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
