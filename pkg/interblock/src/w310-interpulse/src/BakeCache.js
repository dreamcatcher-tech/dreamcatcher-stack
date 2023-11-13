import assert from 'assert-fast'
import posix from 'path-browserify'
import Debug from 'debug'
import { Address, Pulse, PulseLink } from '../../w008-ipld'
import { Map as IMap } from 'immutable'
import { pushable } from 'it-pushable'

const debug = Debug('interblock:api:BakeCache')

/**
 * Format is: chainId -> {
 *    pulseId, // latest known pulseId, which may be ahead of the pulse
 *    pulse, // the last fully walked pulse, or the first unwalked pulse
 *    channels<Map<channelId, channel>>, // the last fully walked channels, or the first progressively walked channels
 *    done // true if the pulse has been fully walked, so it can be used as a prior
 * }
 *
 * pulse and channels are a matched pair
 */
export class BakeCache {
  #yieldStream
  #chains = new Map() // cids -> { pulseId, pulse, channels, done }
  #covenants = new Map() // paths -> pulse
  static create(yieldStream) {
    assert.strictEqual(typeof yieldStream.push, 'function')
    const cache = new BakeCache()
    cache.#yieldStream = yieldStream
    return cache
  }
  static createCI() {
    const yieldStream = pushable({ objectMode: true })
    return BakeCache.create(yieldStream)
  }
  setCovenant(path, pulse) {
    assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
    assert(pulse instanceof Pulse)
    assert(!this.#covenants.has(path))
    this.#covenants.set(path, pulse)
    this.#yieldStream.push({ type: 'COVENANT', path, pulse })
  }
  preBake(address, pulseId) {
    assert(address instanceof Address)
    assert(pulseId instanceof PulseLink)
    const key = address.getChainId()
    if (!this.#chains.has(key)) {
      this.#chains.set(key, {})
    }
    const tracker = this.#chains.get(key)
    if (!pulseId.equals(tracker.pulseId)) {
      this.#chains.set(key, { ...tracker, pulseId })
      this.#yieldStream.push({ type: 'PRE_BAKE', address, pulseId })
    }
  }
  isBaked(address, pulseId) {
    assert(address instanceof Address)
    assert(pulseId instanceof PulseLink)
    const key = address.getChainId()
    assert(this.#chains.has(key), `not initialized: ${address}`)
    const tracker = this.#chains.get(key)
    assert(pulseId.equals(tracker.pulseId))
    if (tracker.pulse) {
      if (!tracker.pulse.getPulseLink().equals(pulseId)) {
        return false
      }
      return this.isWalked(address)
    }
    return false
  }
  hasPulse(address) {
    assert(address instanceof Address)
    const key = address.getChainId()
    if (!this.#chains.has(key)) {
      return false
    }
    const { pulse } = this.#chains.get(key)
    return !!pulse
  }
  getPulse(address) {
    assert(address instanceof Address)
    const key = address.getChainId()
    const { pulse } = this.#chains.get(key)
    assert(pulse instanceof Pulse, `no pulse for ${address}`)
    return pulse
  }
  setVirginPulse(address, pulse) {
    assert(address instanceof Address)
    assert(pulse instanceof Pulse)
    const key = address.getChainId()
    assert(this.isVirgin(address), `already baked: ${address}`)
    const tracker = this.#chains.get(key)
    const { pulseId } = tracker
    assert(pulseId instanceof PulseLink)
    assert(pulseId.equals(pulse.getPulseLink()))
    this.#chains.set(key, { ...tracker, pulse })
    this.#yieldStream.push({ type: 'VIRGIN_PULSE', address, pulse })
  }
  isVirgin(address) {
    assert(address instanceof Address)
    const key = address.getChainId()
    assert(this.#chains.has(key), `not initialized: ${address}`)
    const { pulse, done, channels } = this.#chains.get(key)
    return !pulse && !done && !channels
  }
  isWalked(address) {
    assert(address instanceof Address)
    const key = address.getChainId()
    assert(this.#chains.has(key), `not initialized: ${address}`)
    const { done, pulse, channels } = this.#chains.get(key)
    if (done) {
      assert(pulse instanceof Pulse)
      assert(IMap.isMap(channels))
    }
    return !!done
  }
  hasChannels(address) {
    assert(address instanceof Address)
    const key = address.getChainId()
    assert(this.#chains.has(key), `not initialized: ${address}`)
    const { channels } = this.#chains.get(key)
    return !!channels
  }
  getChannels(address) {
    assert(address instanceof Address)
    const key = address.getChainId()
    assert(this.#chains.has(key), `not initialized: ${address}`)
    const { channels } = this.#chains.get(key)
    assert(IMap.isMap(channels))
    return channels
  }
  updateChannels(address, channels) {
    assert(address instanceof Address)
    assert(IMap.isMap(channels))
    const key = address.getChainId()
    const { done, ...rest } = this.#chains.get(key)
    assert(!done, `already done: ${address}`)
    this.#chains.set(key, { ...rest, channels })
    this.#yieldStream.push({ type: 'UPDATE_CHANNELS', address })
  }
  finalize(address, pulse, channels) {
    assert(address instanceof Address)
    assert(pulse instanceof Pulse)
    assert(IMap.isMap(channels))
    const key = address.getChainId()
    const { pulseId } = this.#chains.get(key)
    assert(pulseId.equals(pulse.getPulseLink()))
    this.#chains.set(key, { pulseId, pulse, channels, done: true })
    this.#yieldStream.push({ type: 'FINALIZE', address, pulse })
  }
  hasCovenant(path) {
    assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
    return this.#covenants.has(path)
  }
  getCovenant(path) {
    assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
    assert(this.#covenants.has(path), `no covenant for path: ${path}`)
    return this.#covenants.get(path)
  }
}
