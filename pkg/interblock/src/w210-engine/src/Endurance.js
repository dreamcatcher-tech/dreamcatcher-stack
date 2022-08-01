import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { Pulse, PulseLink } from '../../w008-ipld'
import { Logger } from './Logger'
import { CarWriter, CarReader } from '@ipld/car'
import all from 'it-all'
import Debug from 'debug'
const debug = Debug('interblock:engine:Endurance')

async function createCar(blocks) {
  const rootBlock = blocks[0]
  const { writer, out } = await CarWriter.create([rootBlock.cid])

  writer.put(rootBlock).then(async () => {
    for (const block of blocks.slice(1)) {
      await writer.put(block)
    }
    await writer.close()
  })
  return out
}

export class Endurance {
  #logger = new Logger()
  #mockIpfs = new Map()
  #ipfs
  #cache = new Map()
  #cacheSize = 0
  #lru = new Set()
  get logger() {
    return this.#logger
  }
  setIpfs(ipfs) {
    assert(ipfs)
    this.#ipfs = ipfs
  }
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(pulse.isVerified())
    if (this.#ipfs) {
      const blocks = [...pulse.getDiffBlocks().values()]
      const car = await createCar(blocks)
      await all(this.#ipfs.dag.import(car))
    } else {
      const blocks = pulse.getDiffBlocks()
      for (const [key, value] of blocks.entries()) {
        if (!this.#mockIpfs.has(key)) {
          this.#mockIpfs.set(key, value)
        }
      }
    }
    await this.#logger.pulse(pulse)
    this.#cache.set(pulse.cid.toString(), pulse)

    const address = pulse.getAddress().getChainId().substring(0, 14)
    const pulselink = pulse.getPulseLink().cid.toString().substring(0, 14)
    debug(`endure`, address, pulselink)
  }
  async recover(pulselink) {
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
    assert(this.#mockIpfs.has(key), `No block for: ${key}`)
    return this.#mockIpfs.get(key)
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
  async ipfsStart() {}
  async ipfsStop() {}
}
