import assert from 'assert-fast'
import posix from 'path-browserify'
import Debug from 'debug'
import { Pulse, PulseLink } from '../../w008-ipld'
import Immutable from 'immutable'
import { pushable } from 'it-pushable'

const debug = Debug('interblock:api:BakeCache')

export class BakeCache {
  #yieldStream
  #pulses = new Map() // cids -> { pulse, children<Map( path -> cid )> }
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
    this.#yieldStream.push({ type: 'COVENANT' })
  }
  initialize(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const key = pulseLink.cid.toString()
    assert(!this.#pulses.has(key), `already initialized: ${pulseLink}`)
    this.#pulses.set(key, {})
    this.#yieldStream.push({ type: 'INITIALIZE' })
  }
  setPulse(pulseLink, pulse) {
    assert(pulseLink instanceof PulseLink)
    assert(pulse instanceof Pulse)
    const key = pulseLink.cid.toString()
    assert(this.#pulses.has(key), `not initialized: ${pulseLink}`)
    const tracker = this.#pulses.get(key)
    assert(!tracker.pulse)
    this.#pulses.set(key, { ...tracker, pulse })
    this.#yieldStream.push({ type: 'PULSE' })
  }
  updateChildren(pulseLink, nextChildren) {
    assert(pulseLink instanceof PulseLink)
    assert(Immutable.Map.isMap(nextChildren))
    const key = pulseLink.cid.toString()
    const { pulse, children, ...rest } = this.#pulses.get(key)
    assert(!pulse || pulse instanceof Pulse)
    assert(!children || Immutable.Map.isMap(children))
    assert.strictEqual(Object.keys(rest).length, 0)
    this.#pulses.set(key, { pulse, children: nextChildren })
    this.#yieldStream.push({ type: 'CHILDREN' })
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
  hasPulse(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const key = pulseLink.cid.toString()
    if (!this.#pulses.has(key)) {
      return false
    }
    const { pulse } = this.#pulses.get(key)
    return !!pulse
  }
  getPulse(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const key = pulseLink.cid.toString()
    const { pulse } = this.#pulses.get(key)
    assert(pulse instanceof Pulse)
    return pulse
  }
  hasChildren(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const key = pulseLink.cid.toString()
    if (!this.#pulses.has(key)) {
      return false
    }
    const { children } = this.#pulses.get(key)
    return !!children
  }
  getChildren(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const key = pulseLink.cid.toString()
    assert(this.#pulses.has(key))
    const { children } = this.#pulses.get(key)
    assert(Immutable.Map.isMap(children))
    return children
  }
}
