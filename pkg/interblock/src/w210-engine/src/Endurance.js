import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Address, Pulse, PulseLink } from '../../w008-ipld'
import { Logger } from './Logger'
import Debug from 'debug'
const debug = Debug('interblock:engine:Endurance')

export class Endurance {
  static create() {
    const instance = new Endurance()
    return instance
  }
  #isStarted = true
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
  #latests = new Map()
  async findLatest(address) {
    assert(address instanceof Address)
    this.assertStarted()
    const chainId = address.getChainId()
    if (this.#latests.has(chainId)) {
      const pulseLink = this.#latests.get(chainId)
      return await this.recover(pulseLink)
    }
  }
  async endure(latest) {
    assert(latest instanceof Pulse)
    assert(latest.isVerified())
    this.assertStarted()

    if (!this.selfAddress) {
      // the first thing saved must be the node identity
      assert(!this.selfLatest)
      assert(!this.#latests.size)
      this.#selfAddress = latest.getAddress()
    }
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
    this.assertStarted()
    const cidString = pulselink.cid.toString()
    debug(`recover`, cidString)

    if (this.#pulseCache.has(cidString)) {
      // TODO update the LRU tracker
      return this.#pulseCache.get(cidString)
    }
  }
  get blockCache() {
    return this.#blockCache
  }
  getResolver(treetop) {
    assert(treetop instanceof CID)
    // TODO WARNING permissions must be honoured
    // use treetop to only fetch things below this CID
    return async (cid) => {
      assert(cid instanceof CID, `not cid: ${cid}`)
      this.assertStarted()

      const key = cid.toString()
      if (this.#blockCache.has(key)) {
        return this.#blockCache.get(key)
      }
      throw new Error(`No block for: ${key}`)
    }
  }
  assertStarted() {
    if (!this.#isStarted) {
      throw new Error('Endurange is stopped')
    }
  }
  stop() {
    assert(this.#isStarted)
    this.#isStarted = false
  }
}
