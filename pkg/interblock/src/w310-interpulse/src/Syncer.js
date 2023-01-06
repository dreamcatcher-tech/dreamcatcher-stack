import delay from 'delay'
import assert from 'assert-fast'
import Debug from 'debug'
import {
  Hamt,
  IpldInterface,
  Pulse,
  PulseLink,
  HistoricalPulseLink,
} from '../../w008-ipld'
import { Crisp } from '..'
import Immutable from 'immutable'
import { pushable } from 'it-pushable'
import debounce from 'debounce'
import parallel from 'it-parallel'
import map from 'it-map'
import drain from 'it-drain'

// debounce(fn, wait, [ immediate || false ])

const debug = Debug('interblock:api:Syncer')

export class Syncer {
  #pulseResolver
  #inflater

  #pulse
  #pulseMap
  #next

  #subscribers = new Set()
  #todo
  concurrency = 10
  static create(pulseResolver) {
    assert.strictEqual(typeof pulseResolver, 'function')
    const syncer = new Syncer()
    syncer.#pulseResolver = pulseResolver
    return syncer
  }
  #updateLatest(latestRootPulse) {
    assert(latestRootPulse instanceof Pulse)
    this.#pulse = latestRootPulse
    for (const source of this.#subscribers) {
      source.push(this.#pulseMap)
    }
  }
  async update(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.cid.equals(this.#pulse?.cid))
    assert(!pulse.cid.equals(this.#next?.cid))
    // TODO assert lineage matches
    // this.#next = pulse
    // if (!this.#inflater) {
    //   this.#inflater = this.#startWorker()
    // }
    // await this.#inflater
    await this.#update(pulse)
    this.#updateLatest(pulse)
  }

  /**
   * Will mutate instance and all children of instance
   * by expanding any PulseLinks to Pulses, and any Hamts to Maps.
   * @param {IpldInterface | [IpldInterface]} instance
   */
  async #update(instance, prior) {
    if (Array.isArray(instance)) {
      assert(!prior || Array.isArray(prior))
      return await Promise.all(
        instance.map((_, i) => this.#update(i, prior?.[i]))
      )
    }
    if (!(instance instanceof IpldInterface)) {
      return
    }
    assert(!prior || prior instanceof IpldInterface)
    if (instance instanceof HistoricalPulseLink) {
      return
    }
    if (instance instanceof PulseLink) {
      if (instance.bakedPulse) {
        return
      }
      const pulse = await this.#pulseResolver(instance)
      instance.bake(pulse)
      return await this.#update(instance.bakedPulse, prior?.bakedPulse)
    }
    if (instance instanceof Hamt) {
      return await this.#updateHamt(instance, prior)
    }

    const { classMap = {}, defaultClass } = instance.constructor
    await Promise.all(
      Object.keys(classMap).map(async (key) => {
        const value = instance[key]
        await this.#update(value, prior?.[key])
      })
    )
    if (defaultClass) {
      const values = []
      const priorValues = []
      for (const [key, value] of Object.entries(instance)) {
        values.push(value)
        priorValues.push(prior?.[key])
      }
      await this.#update(values, priorValues)
    }
  }

  async #updateHamt(hamt, prior) {
    assert(hamt instanceof Hamt)
    assert(!prior || prior instanceof Hamt)
    if (hamt.bakedMap) {
      return
    }
    const diff = await hamt.compare(prior)
    const { added, deleted, modified } = diff
    let map = prior?.bakedMap ?? Immutable.Map()
    assert(map instanceof Immutable.Map)
    for (const key of deleted) {
      map = map.delete(key)
    }
    for (const key of modified) {
      const value = await hamt.get(key)
      map = map.set(key, value)
      let priorValue
      if (prior) {
        if (prior.bakedMap.has(key)) {
          priorValue = prior.bakedMap.get(key)
        } else {
          priorValue = await prior.get(key)
        }
      }
      await this.#update(value, priorValue)
    }
    for (const key of added) {
      const value = await hamt.get(key)
      map = map.set(key, value)
      await this.#update(value)
    }
    hamt.bake(map)
  }

  async *[Symbol.asyncIterator]() {
    const source = pushable({ objectMode: true })
    this.#subscribers.add(source)
    if (this.#pulse) {
      source.push(this.#pulse)
    }
    try {
      for await (const pulse of source) {
        const crisp = Crisp.createRoot(pulse)
        yield crisp
      }
    } finally {
      source.return()
      this.#subscribers.delete(source)
    }
  }
}
