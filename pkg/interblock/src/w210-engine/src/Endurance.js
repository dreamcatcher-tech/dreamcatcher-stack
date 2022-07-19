import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Pulse, PulseLink } from '../../w008-ipld'
import { Logger } from './Logger'
import Debug from 'debug'
const debug = Debug('interblock:engine:services')

export class Endurance {
  #logger = new Logger()
  #mockIpfs = new Map()
  #mockSoftIpfs = new Map()
  get logger() {
    return this.#logger
  }
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(pulse.isVerified())
    this.#mockIpfs.set(pulse.cid.toString(), pulse)
    await this.#logger.pulse(pulse)
    const address = pulse.getAddress().getChainId().substring(0, 14)
    const pulselink = pulse.getPulseLink().cid.toString().substring(0, 14)
    const d = pulse.getDiffBlocks()
    // console.dir(d, { depth: Infinity })
    debug(`endure`, address, pulselink)
  }
  async recoverPulse(pulselink) {
    // get ipfs block any way possible
    // place a resolver function in the pulse to look up the hamt
    assert(pulselink instanceof PulseLink)
    assert(this.#mockIpfs.has(pulselink.cid.toString()))
    return this.#mockIpfs.get(pulselink.cid.toString())
  }
  async resolveCid(cid) {
    // TODO WARNING permissions must be honoured
    assert(cid instanceof CID)
    const key = cid.toString()
    if (this.#mockSoftIpfs.has(key)) {
      console.log('asdf')
    }
    assert(this.#mockIpfs.has(key), `No block for: ${key}`)
    return this.#mockIpfs.get(key)
  }
  async softEndure(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isModified())
    assert(!pulse.isVerified())
    const key = pulse.getAddress().getChainId()
    assert(key)
    this.#mockSoftIpfs.set(key, pulse)
  }
  async softRecover(softPulselink) {
    assert(this.#mockSoftIpfs.has())
    throw new Error('not implemented')
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
}
