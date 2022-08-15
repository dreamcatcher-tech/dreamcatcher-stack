import assert from 'assert-fast'
import { CID } from 'multiformats/cid'
import { decode, Pulse, PulseLink } from '../../w008-ipld'
import { Logger } from './Logger'
import { CarWriter } from '@ipld/car'
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
  #ipfsCache = new Map()
  #ipfs
  #pulseCache = new Map()
  #cacheSize = 0
  #lru = new Set() // TODO make an LRU that calculates block size
  get logger() {
    return this.#logger
  }
  get ipfs() {
    return this.#ipfs
  }
  setIpfs(ipfs) {
    assert(ipfs)
    this.#ipfs = ipfs
  }
  #ipfsWritePromise = Promise.resolve()
  #ipfsWriteCount = 0
  #ipfsWriteResolve
  #isWriting() {
    if (!this.#ipfsWriteCount) {
      this.#ipfsWritePromise = new Promise((resolve) => {
        this.#ipfsWriteResolve = resolve
      })
    }
    this.#ipfsWriteCount++
  }
  #writingComplete() {
    this.#ipfsWriteCount--
    if (!this.#ipfsWriteCount) {
      this.#ipfsWriteResolve()
      this.#ipfsWriteResolve = undefined
      this.#ipfsWritePromise = Promise.resolve()
    }
  }
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.isModified())
    assert(pulse.isVerified())
    const entries = pulse.getDiffBlocks()
    const blocks = []
    for (const [key, block] of entries.entries()) {
      // TODO if ipfs present, limit the cache size
      this.#ipfsCache.set(key, block)
      blocks.push(block)
    }
    this.#pulseCache.set(pulse.cid.toString(), pulse)
    let resolve
    const ipfsFlushed = new Promise((_resolve) => {
      resolve = _resolve
    })
    if (this.#ipfs) {
      this.#isWriting()
      Promise.resolve()
        .then(async () => {
          debug(`start ipfs put`, pulse.getPulseLink())
          const car = await createCar(blocks)
          await all(this.#ipfs.dag.import(car))
          debug(`finish ipfs put`, pulse.getPulseLink())
          this.#writingComplete()
          resolve()
        })
        .catch((error) => {
          debug(`endurance error`, error)
        })
    }
    await this.#logger.pulse(pulse)
    debug(`endure`, pulse.getAddress(), pulse.getPulseLink())
    return [ipfsFlushed]
  }
  async recover(pulselink) {
    assert(pulselink instanceof PulseLink)
    const cidString = pulselink.cid.toString()
    debug(`recover`, cidString)

    if (this.#pulseCache.has(cidString)) {
      // TODO update the LRU tracker
      return this.#pulseCache.get(cidString)
    }

    const resolver = this.getResolver()
    const pulse = await Pulse.uncrush(pulselink.cid, resolver)
    return pulse
  }
  getResolver() {
    // TODO WARNING permissions must be honoured
    return async (cid) => {
      assert(cid instanceof CID, `not cid: ${cid}`)
      const key = cid.toString()
      if (this.#ipfsCache.has(key)) {
        return this.#ipfsCache.get(key)
      }
      assert(this.#ipfs, `No block for: ${key}`)
      if (this.#ipfs) {
        try {
          debug(`ipfs resolve start`, cid)
          const bytes = await this.#ipfs.block.get(cid)
          debug(`ipfs resolve complete`, cid)
          return await decode(bytes)
        } catch (e) {
          const resetIpfsStackTrace = new Error(e.message + ' ' + cid)
          throw resetIpfsStackTrace
        }
      }
    }
  }
  async scrub(pulse, { history } = {}) {
    // walk the pulse, its interpulses, and optionally its history and binaries
  }
  async fade(pulse) {
    // remove the pulse from local storage whenever next convenience arises
  }
  async ipfsStart() {
    if (!this.#ipfs) {
      throw new Error(`no ipfs instance`)
    }
    await this.#ipfs.start()
  }
  async ipfsStop() {
    if (!this.#ipfs) {
      throw new Error(`no ipfs instance`)
    }
    await this.#ipfsWritePromise
    const ipfs = this.#ipfs
    this.#ipfs = undefined
    await ipfs.stop()
  }
}
