import { CID } from 'multiformats/cid'
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
  async streamWalk(stream, pulse, prior, type) {
    assert.strictEqual(typeof stream.push, 'function')
    assert(pulse instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type], `invalid recovery type ${type}`)
    const types = Lifter.RECOVERY_TYPES
    const withChildren = [types.deepPulse, types.crispDeepPulse].includes(
      types[type]
    )
    const noHamts = [types.pulse, types.interpulse].includes(types[type])

    const blocks = new Set()
    const localResolver = this.getResolver(pulse.cid)
    const loggingResolver = async (cid) => {
      // TODO move queue to be LIFO by buffering older resolvers behind newer
      const block = await localResolver(cid)
      assert(CID.asCID(block.cid))
      assert(block.value)
      if (blocks.has(block.cid.toString())) {
        return block
      }
      blocks.add(block.cid.toString())
      stream.push(block)
      return block
    }
    const toExport = [pulse]
    while (toExport.length) {
      const pulse = toExport.shift()
      debug('exporting %s', pulse)
      const instance = await Pulse.uncrush(pulse.cid, loggingResolver)
      const network = instance.getNetwork()
      if (!noHamts) {
        await network.walkHamts()
      }
      if (withChildren) {
        for await (const [, channel] of network.channels.list.entries()) {
          if (channel.rx.latest) {
            debug('queuing child for export %s', channel.rx.latest)
            toExport.push(channel.rx.latest)
          }
        }
      }
    }
    debug('exporting %d blocks', blocks.size)
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
      }
      return await this.#wantList.get(cidString).promise
    }
  }
  async pushLiftedBytes(bytes) {
    const block = await decode(bytes)
    super.cacheBlock(block)
    const cidString = block.cid.toString()
    if (this.#wantList.has(cidString)) {
      const tracker = this.#wantList.get(cidString)
      this.#wantList.delete(cidString)
      tracker.resolve(block)
    }
    this.#net.repo.blocks.put(block.cid, block.bytes)
    return block
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
