import { concat } from 'uint8arrays'
import all from 'it-all'
import { CarWriter } from '@ipld/car'
import { CID } from 'multiformats/cid'
import { decode, PulseLink, Channel, Pulse } from '../../w008-ipld/index.mjs'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
import { PulseNet } from '..'
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
    this.#listen()
  }
  async #listen() {
    // if lift requests come in, we will fulfill them
    for await (const lift of this.#net.resolveLifts()) {
      // TODO run these requests in parallel
      const { pulseLink, resolve, reject } = lift
      debug('got lift request for %s', pulseLink)
      assert(pulseLink instanceof PulseLink)
      assert.strictEqual(typeof resolve, 'function')
      assert.strictEqual(typeof reject, 'function')
      Promise.resolve().then(async () => {
        try {
          const pulse = await this.#recoverLocal(pulseLink)
          const start = Date.now()
          const blocks = await this.#walk(pulse)
          const blockMs = Date.now() - start
          const carIterable = await this.#writeCar(pulse, blocks)
          const carArrays = await all(carIterable)
          const car = concat(carArrays)
          const ms = Date.now() - start
          if (car.length > 1e6) {
            console.error(
              'car is %i took %i ms blocks took %i ms',
              car.length,
              ms,
              blockMs
            )
          }
          // TODO use streaming to save peak ram usage
          // TODO ensure writer uses block bytes by reference
          resolve(car)
        } catch (error) {
          reject(error)
        }
      })
    }
  }
  async #writeCar(pulse, blocks) {
    assert(pulse instanceof Pulse)
    assert(blocks instanceof Map)
    const { writer, out } = await CarWriter.create([pulse.cid])
    for (const block of blocks.values()) {
      writer.put(block)
    }
    writer.close()
    return out
  }
  async #walk(pulse, withChildren = false, noHamts = false) {
    assert(pulse instanceof Pulse)
    const blocks = new Map()
    const localResolver = this.getLocalResolver(pulse.cid)
    const loggingResolver = async (cid) => {
      const block = await localResolver(cid)
      assert(CID.asCID(block.cid))
      assert(block.value)
      blocks.set(block.cid.toString(), block)
      return block
    }
    const toExport = [pulse.getPulseLink()]
    while (toExport.length) {
      const pulseLink = toExport.shift()
      const instance = await Pulse.uncrush(pulseLink.cid, loggingResolver)
      const network = instance.getNetwork()
      if (!noHamts) {
        const startSize = blocks.size
        const start = Date.now()
        await network.walkHamts()
        const walkDiff = blocks.size - startSize
        const ms = Date.now() - start
        if (walkDiff > 1000) {
          console.error('walked %i blocks in %i ms', walkDiff, ms)
        }
      }
      if (withChildren) {
        for await (const [, channel] of network.channels.list.entries()) {
          if (channel.rx.latest) {
            toExport.push(channel.rx.latest)
          }
        }
      }
    }
    debug('exporting %d blocks', blocks.size)
    return blocks
  }
  async #recoverLocal(pulseLink) {
    const cachedResult = await super.recover(pulseLink)
    if (cachedResult) {
      return cachedResult
    }
    const resolver = this.#net.getLocalResolver(pulseLink.cid)
    const pulse = await Pulse.uncrush(pulseLink.cid, resolver)
    super.cachePulse(pulse)
    return pulse
  }
  /**
   * @param {PulseLink} pulseLink
   * @returns {Promise<Pulse>}
   *
   * Block any other requests for this pulse
   * First, check the Pulse cache.
   * If no pulse, check the block cache.
   * If no block, check the network.
   * Try get the latest prior pulse that we do have.
   * Try pull the whole pulse, using the prior pulse for diffing
   * Try use bitswap to find the pulse, waiting forever until it arrives
   *
   * Once it arrives,
   * Cache the pulse.
   * Gradually transfer the blocks over to our storage.
   * Ultimately remove the the car resolver and use just the blocks.
   */
  async recover(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const cachedResult = await super.recover(pulseLink)
    if (cachedResult) {
      return cachedResult
    }
    try {
      const car = await this.#net.pullCar(pulseLink)
      const [root, ...rest] = await car.getRoots()
      assert(rest.length === 0)
      const resolver = this.getCarResolver(car)
      const pulse = await Pulse.uncrush(root, resolver)
      super.cachePulse(pulse)
      return pulse
    } catch (error) {
      debug(`failed to recover pulse %s`, pulseLink, error)
    }
    const resolver = this.getResolver(pulseLink.cid)
    const pulse = await Pulse.uncrush(pulseLink.cid, resolver)
    super.cachePulse(pulse)
    return pulse
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
  getLocalResolver(treetop) {
    const onlyLocal = true
    return this.getResolver(treetop, onlyLocal)
  }
  getResolver(treetop, onlyLocal = false) {
    assert(CID.asCID(treetop))
    let netResolver
    if (onlyLocal) {
      netResolver = this.#net.getLocalResolver(treetop)
    } else {
      netResolver = this.#net.getBitswapResolver(treetop)
    }
    const cacheResolver = super.getResolver(treetop)
    // TODO WARNING permissions must be honoured
    // TODO use treetop to only fetch things below this CID
    return async (cid) => {
      const cachedResult = await cacheResolver(cid)
      if (cachedResult) {
        return cachedResult
      }
      // TODO feed into the blockcache with ejection
      const block = await netResolver(cid)
      super.cacheBlock(block)
      return block
    }
  }
  getCarResolver(car) {
    assert.strictEqual(typeof car.get, 'function')
    return async (cid) => {
      assert(CID.asCID(cid), `not cid: ${cid}`)
      debug('resolving', PulseLink.parse(cid))
      // TODO use the blockCache
      const result = await car.get(cid)
      assert(cid.equals(result.cid))
      const block = await decode(result.bytes)
      super.cacheBlock(block)
      return block
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
const isMtab = (pulse) => {
  assert(pulse instanceof Pulse)
  return pulse.getCovenantPath() === '/system:/net'
}
