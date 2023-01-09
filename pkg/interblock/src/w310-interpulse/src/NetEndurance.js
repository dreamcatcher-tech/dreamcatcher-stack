import { CID } from 'multiformats/cid'
import { PulseLink } from '../../w008-ipld/index.mjs'
import assert from 'assert-fast'
import { Endurance } from '../../w210-engine'
import { PulseNet } from '../../w305-libp2p'
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
  }
  async endure(latest) {
    let isBootstrapPulse = !this.selfAddress
    await super.endure(latest)
    this.#writeStart()
    const result = this.#net.endure(latest)
    debug(`start ipfs put`, latest.getPulseLink())
    result.then(() => {
      debug(`finish net endure`, latest.getPulseLink())
      this.#writeStop()
    })
    if (isBootstrapPulse || this.selfAddress.equals(latest.getAddress())) {
      const pulselink = latest.getPulseLink().cid.toString()
      this.#net.repo.config.set('latest', pulselink)
    }
  }
  async recover(pulselink) {
    const result = await super.recover(pulselink)
    if (result) {
      return result
    }
    return await this.#net.getPulse(pulselink)
  }
  getResolver(treetop) {
    const netResolver = this.#net.getResolver(treetop)
    assert(CID.asCID(treetop))
    // TODO WARNING permissions must be honoured
    // TODO use treetop to only fetch things below this CID
    return async (cid) => {
      assert(CID.asCID(cid), `not cid: ${cid}`)
      this.assertStarted()
      const key = cid.toString()
      if (this.blockCache.has(key)) {
        return this.blockCache.get(key)
      }
      return await netResolver(cid)
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
