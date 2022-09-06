import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Address, decode, Pulse, PulseLink } from '../../w008-ipld'
import { Logger } from './Logger'
import all from 'it-all'
import Debug from 'debug'
import { PulseNet } from '../../w208-libp2p'
const debug = Debug('interblock:engine:Endurance')

export class Endurance {
  static create(pulseNet) {
    const instance = new Endurance()
    if (pulseNet) {
      assert(pulseNet instanceof PulseNet)
      instance.#net = pulseNet
    }
    return instance
  }
  #isStarted = true
  #net
  #selfLatest
  #selfAddress
  #logger = new Logger()
  #blockCache = new Map()
  #pulseCache = new Map()
  #cacheSize = 0
  #lru = new Set() // TODO make an LRU that calculates block size
  get logger() {
    return this.#logger
  }
  get selfLatest() {
    return this.#selfLatest
  }
  get selfAddress() {
    return this.#selfAddress
  }
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
  async start() {
    // TODO when endurance loads, begin propogation of latest, in case anyone missed it, and propogation of interpulses, as these might have not been received
    if (!this.#net) {
      return
    }
    // load the repo
  }
  #latests = new Map()
  async findLatest(address) {
    assert(address instanceof Address)
    const chainId = address.getChainId()
    if (this.#latests.has(chainId)) {
      const pulseLink = this.#latests.get(chainId)
      return await this.recover(pulseLink)
    }
    if (this.#net) {
      // subscribe to the address and get the first result
      // provide varying degrees of confidence whenever an answer is emitted
      // allow specification of absolute authority, or good enough will do
    }
    throw new Error(`could not find latest for: ${chainId}`)
  }
  async endure(latest) {
    // the first thing we save is the identity of the node
    // from this point on, it will update self and latest

    assert(latest instanceof Pulse)
    assert(latest.isVerified())

    if (!this.selfAddress) {
      assert(!this.selfLatest)
      assert(!this.#latests.size)
      this.#selfAddress = latest.getAddress()
      this.#selfLatest = latest
    }
    // update the latests map
    const chainId = latest.getAddress().getChainId()
    const latestLink = this.#latests.get(chainId)
    if (latestLink) {
      const current = await this.recover(latestLink)
      assert(current.isNext(latest))
    }
    this.#latests.set(chainId, latest.getPulseLink())

    if (this.selfAddress.equals(latest.getAddress())) {
      this.#selfLatest = latest
    }

    this.#pulseCache.set(latest.cid.toString(), latest)
    this.#cacheBlocks(latest)

    await this.#logger.pulse(latest)
    if (this.#net) {
      this.#writeStart()
      const result = this.#net.endure(latest)
      debug(`start ipfs put`, latest.getPulseLink())
      result.then(() => {
        debug(`finish net endure`, latest.getPulseLink())
        this.#writeStop()
      })
    }
    debug(`endure`, latest.getAddress(), latest.getPulseLink())
  }
  #cacheBlocks(latest) {
    const diffs = latest.getDiffBlocks()
    for (const [key, block] of diffs) {
      this.#blockCache.set(key, block)
    }
  }
  async recover(pulselink) {
    assert(pulselink instanceof PulseLink)
    const cidString = pulselink.cid.toString()
    debug(`recover`, cidString)

    if (this.#pulseCache.has(cidString)) {
      // TODO update the LRU tracker
      return this.#pulseCache.get(cidString)
    }
    return await this.#net.getPulse(pulselink)
  }
  getResolver(treetop) {
    assert(treetop instanceof CID)
    // TODO WARNING permissions must be honoured
    // use treetop to only fetch things below this CID
    const netResolver = this.#net && this.#net.getResolver(treetop)
    return async (cid) => {
      assert(cid instanceof CID, `not cid: ${cid}`)
      const key = cid.toString()
      if (this.#blockCache.has(key)) {
        return this.#blockCache.get(key)
      }
      assert(netResolver, `No block for: ${key}`)
      return await netResolver(cid)
    }
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
  async stop() {
    this.#isStarted = false
    await this.#writePromise
  }
}
