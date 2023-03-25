import parallel from 'it-parallel'
import drain from 'it-drain'
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
  IpldInterface,
  IpldStruct,
  HistoricalPulseLink,
  Hamt,
} from '../../w008-ipld/index.mjs'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
import { PulseNet } from '..'
import { Lifter } from './Lifter'
import Debug from 'debug'
import { pushable } from 'it-pushable'
const debug = Debug('interblock:NetEndurance')

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
    // TODO change all this to be streams
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
    const abort = new AbortController()

    debug(`streamWalk ${pulse} ${type}`)
    const start = Date.now()

    const t = Lifter.RECOVERY_TYPES
    const withChildren = [t.deepPulse, t.crispDeepPulse].includes(t[type])
    const noHamts = [t.pulse, t.interpulse].includes(t[type])

    const blockSet = new Map()
    const any = pushable({ objectMode: true })
    pipe(any, async (source) => {
      for await (const block of source) {
        const key = block.cid.toString()
        if (blockSet.has(key)) {
          continue
        }
        blockSet.set(key, block)
        stream.push(block)
      }
      stream.end()
    })

    const walks = pushable({ objectMode: true })
    walks.push({ pulse, prior, withChildren, noHamts })
    let walkCount = 0
    // TODO maybe parallelize the walks
    for await (const { pulse, prior, withChildren, noHamts } of walks) {
      const fullPulse = await this.recover(pulse)
      const fullPrior = prior ? await this.recover(prior) : undefined

      this.#cidWalk(fullPulse, fullPrior, any)

      if (!noHamts) {
        await this.#hamtWalk(fullPulse, fullPrior, any)
      } else {
        await this.#tipHamts(fullPulse, fullPrior, any)
      }
      if (withChildren) {
        const network = fullPulse.getNetwork()
        const pNetwork = fullPrior?.getNetwork()
        const [, dIterator] = await network.diffChannels(pNetwork, abort)
        for await (const channel of dIterator) {
          const latest = channel.rx.latest && PulseLink.parse(channel.rx.latest)
          if (latest) {
            let prior
            if (pNetwork) {
              const { channelId } = channel
              if (await pNetwork.channels.list.has(channelId)) {
                const pChannel = await pNetwork.channels.list.get(channelId)
                prior = pChannel?.rx.latest
              }
            }
            if (latest.equals(prior)) {
              continue
            }
            walkCount++
            walks.push({ pulse: latest, prior, withChildren, noHamts })
          }
        }
      }

      if (!walks.readableLength) {
        walks.end()
        any.end()
      }
    }
    debug('streamWalk done %s %s', pulse, type)
    const { bytes, hashes, count, ms } = stats(blockSet, start)

    debug(
      `streamWalk count: ${count} bytes: ${bytes} hashes: ${hashes} in ${ms}ms children: ${walkCount}`
    )
  }
  async #tipHamts(instance, prior, stream) {
    assert(instance instanceof Pulse)
    assert(!prior || prior instanceof Pulse)
    assert(typeof stream.push === 'function')
    const network = instance.getNetwork()
    const pNetwork = prior?.getNetwork()
    const hamts = network.getHamts()
    const pHamts = pNetwork?.getHamts()
    const resolver = this.getResolver(instance.cid)
    for (const [index, hamt] of hamts.entries()) {
      if (hamt.cid.equals(pHamts?.[index]?.cid)) {
        continue
      }
      const [block] = await resolver(hamt.cid, { noObjectCache: true })
      stream.push(block)
    }
  }

  async #hamtWalk(instance, prior, stream) {
    assert(instance instanceof Pulse)
    assert(!prior || prior instanceof Pulse)
    assert(typeof stream.push === 'function')
    const network = instance.getNetwork()
    const pNetwork = prior?.getNetwork()
    const hamts = network.getHamts()
    const pHamts = pNetwork?.getHamts()
    const resolver = this.getResolver(instance.cid)

    for (const [index, hamt] of hamts.entries()) {
      const pHamt = pHamts?.[index]
      if (pHamt?.cid.equals(hamt.cid)) {
        continue
      }
      if (hamt.isBakeSkippable) {
        // TODO switch based on type of lift requested
        const [block] = await resolver(hamt.cid, { noObjectCache: true })
        stream.push(block)
        continue
      }

      const priorCids = await this.#getHamtCids(pHamt)
      const cids = await this.#getHamtCids(hamt)
      for (const cidString of cids) {
        assert.strictEqual(typeof cidString, 'string')
        if (!priorCids.has(cidString)) {
          const cid = CID.parse(cidString)
          const [block] = await resolver(cid, { noObjectCache: true })
          stream.push(block)
        }
      }
      if (!hamt.isClassed) {
        continue
      }
      const { added, deleted, modified } = await hamt.compare(pHamt)
      assert(added instanceof Set)
      assert(deleted instanceof Set)
      assert(modified instanceof Set)
      const changes = [...added, ...modified]

      const tasks = []

      for (const key of changes) {
        const task = async () => {
          const value = await hamt.get(key)
          assert(value instanceof IpldInterface)
          let pValue
          if (await pHamt?.has(key)) {
            pValue = await pHamt.get(key)
          }
          this.#cidWalk(value, pValue, stream)
        }
        tasks.push(task)
      }
      await drain(parallel(tasks, { concurrency: 10 }))
    }
  }
  #hamtCidsCache = new Map()
  #trimHamtCidsCache() {
    const cacheLimit = 1000
    if (this.#hamtCidsCache.size <= cacheLimit) {
      return
    }
    for (const key of this.#hamtCidsCache.keys()) {
      if (this.#hamtCidsCache.size <= cacheLimit) {
        break
      }
      this.#hamtCidsCache.delete(key)
    }
  }
  async #getHamtCids(hamt) {
    if (!hamt) {
      return new Set()
    }
    assert(hamt instanceof Hamt)
    const key = hamt.cid.toString()
    if (!this.#hamtCidsCache.has(key)) {
      this.#trimHamtCidsCache()
      let resolve
      const promise = new Promise((_resolve) => {
        resolve = _resolve
      })
      this.#hamtCidsCache.set(key, promise)
      const cids = new Set()
      for await (const cid of hamt.cids()) {
        cids.add(cid.toString())
      }
      resolve(cids)
    }
    const cached = await this.#hamtCidsCache.get(key)
    assert(cached instanceof Set)
    return cached
  }
  #cidWalk(instance, prior, stream) {
    assert(instance instanceof IpldInterface)
    assert(!prior || prior instanceof IpldInterface)
    assert(typeof stream.push === 'function')
    assert(!instance.isModified())
    assert(!prior?.isModified())

    if (instance instanceof Address) {
      return
    }
    if (instance instanceof Hamt) {
      return
    }
    if (instance instanceof HistoricalPulseLink) {
      return
    }
    if (instance instanceof PulseLink) {
      return
    }
    const isClassOnly = instance instanceof IpldStruct && instance.isClassOnly()
    if (!isClassOnly) {
      if (instance.cid.equals(prior?.cid)) {
        return
      }
      stream.push(instance.ipldBlock)
    }

    for (const key in instance) {
      const isCidLink = instance.constructor.isCidLink(key)
      const isCidClass = !!instance.constructor.classMap[key]
      if (isCidLink || isCidClass) {
        const value = instance[key]
        const pValue = prior?.[key]
        if (Array.isArray(value)) {
          for (const [index, v] of value.entries()) {
            assert(v instanceof IpldInterface)
            const p = pValue?.[index]
            this.#cidWalk(v, p, stream)
          }
        } else {
          if (value instanceof IpldInterface) {
            this.#cidWalk(value, pValue, stream)
          }
        }
      }
    }
  }

  /**
   * @param {PulseLink} pulseLink
   * @returns {Promise<Pulse>}
   */
  async recover(pulseLink, type = 'hamtPulse', abort) {
    assert(pulseLink instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type], `invalid recovery type ${type}`)

    const resolver = this.getResolver(pulseLink.cid)
    try {
      const pulse = await Pulse.uncrush(pulseLink.cid, resolver)
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
    const result = await this.recover(pulse, 'deepPulse', abort)
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
      await this.#net.repo.config.set('latest', pulselink)
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
    return async (cid, options) => {
      if (eventLoopSpinner.isStarving()) {
        await eventLoopSpinner.spin()
      }
      const cachedResult = await cacheResolver(cid, options)
      if (cachedResult[0]) {
        return cachedResult
      }
      // TODO feed into the blockcache with ejection
      const block = await netResolver(cid)
      super.cacheBlock(block)
      const result = await cacheResolver(cid, options)
      return result
    }
  }
  #wantList = new Map() // cidString -> promise
  #getNetResolver(treetop) {
    assert(CID.asCID(treetop))
    // TODO WARNING permissions must be honoured
    // TODO use treetop to only fetch things below this CID
    const raceResolver = super.getResolver(treetop)
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
          tracker.resolve(block)
        }
        const [raceCheck] = await raceResolver(cid, { noObjectCache: true })
        if (raceCheck) {
          tracker.resolve(raceCheck)
        }
        promise.then(() => this.#wantList.delete(cidString))
      }

      const block = await this.#wantList.get(cidString).promise
      return block
    }
  }
  async pushLiftedBytes(bytes) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin()
    }
    let block = await decode(bytes)
    block = super.cacheBlock(block)

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
const stats = (map, start) => {
  let count = 0
  let rawBytes = 0
  let hashes = 0
  const ms = Date.now() - start
  for (const value of map.values()) {
    count++
    rawBytes += value.bytes.length
    hashes += value.cid.bytes.length
  }
  return { count, bytes: bytes(rawBytes), hashes: bytes(hashes), ms }
}
