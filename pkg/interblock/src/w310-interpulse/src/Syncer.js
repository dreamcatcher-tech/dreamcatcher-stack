import delay from 'delay'
import throttle from 'lodash.throttle'
import assert from 'assert-fast'
import posix from 'path-browserify'
import Debug from 'debug'
import {
  Dmz,
  Hamt,
  IpldInterface,
  Pulse,
  PulseLink,
  HistoricalPulseLink,
} from '../../w008-ipld'
import { Crisp } from '..'
import Immutable from 'immutable'
import { pushable } from 'it-pushable'

const debug = Debug('interblock:api:Syncer')
const TYPE = 'crispDeepPulse'

export class Syncer {
  #concurrency = 2
  #pulseResolver
  #covenantResolver
  #actions
  #chroot
  #pulse
  #subscribers = new Set()
  #abort = new AbortController()
  #crisp = Crisp.createLoading()
  #pulseResolvesQueue = new Set()
  #pulseResolves = new Set()

  static create(pulseResolver, covenantResolver, actions, chroot = '/') {
    assert.strictEqual(typeof pulseResolver, 'function')
    assert.strictEqual(typeof covenantResolver, 'function')
    assert.strictEqual(typeof actions, 'object')
    assert.strictEqual(typeof actions.dispatch, 'function')
    assert(posix.isAbsolute(chroot), `chroot must be absolute path: ${chroot}`)

    const syncer = new Syncer()
    syncer.#pulseResolver = pulseResolver
    syncer.#covenantResolver = covenantResolver
    syncer.#actions = actions
    syncer.#chroot = chroot
    return syncer
  }
  async update(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.cid.equals(this.#pulse?.cid))
    this.#abort.abort('new pulse received' + pulse.toString())
    this.#abort = new AbortController()
    this.#pulseResolvesQueue.clear()
    this.#pulseResolves.clear()

    // TODO assert lineage matches
    // TODO permit skips in lineage
    const prior = this.#pulse
    this.#pulse = pulse
    const pulseLink = pulse.getPulseLink()
    const deep = await this.#resolve(pulseLink)
    await this.#bake(deep, prior)
    const isDeepLoaded = true
    await this.#yield(isDeepLoaded)

    // TODO handle race conditions if called quickly
  }

  async #resolve(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const promise = new Promise((resolve, reject) => {
      const initTime = Date.now()
      const request = async () => {
        try {
          const startTime = Date.now()
          const pulse = await this.#pulseResolver(pulseLink, TYPE, this.#abort)
          const endTime = Date.now()
          const qTime = startTime - initTime
          const rTime = endTime - startTime
          debug('pulse q time: %s resolve time: %s', qTime, rTime)
          resolve(pulse)
        } catch (error) {
          reject(error)
        }
      }
      this.#pulseResolvesQueue.add(request)
    })
    this.#tickle()
    return promise
  }
  #tickle() {
    if (this.#pulseResolves.size >= this.#concurrency) {
      // debug('concurrency limit over by: %s', this.#pulseResolvesQueue.size)
      return
    }
    for (const request of this.#pulseResolvesQueue) {
      this.#pulseResolvesQueue.delete(request)
      const promise = request()
      this.#pulseResolves.add(promise)
      promise.then(() => {
        this.#pulseResolves.delete(promise)
        this.#tickle()
      })
    }
  }

  /**
   * Will mutate instance and all children of instance
   * by expanding any PulseLinks to Pulses, and any Hamts to Maps.
   * @param {IpldInterface | [IpldInterface]} instance
   */
  async #bake(instance, prior) {
    if (Array.isArray(instance)) {
      assert(!prior || Array.isArray(prior))
      return await Promise.all(
        instance.map((v, i) => this.#bake(v, prior?.[i]))
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

      const pulse = await this.#resolve(instance, TYPE, this.#abort)
      debug('pulse resolved', pulse)
      instance.bake(pulse)
      await this.#yield()
      await this.#bake(instance.bakedPulse, prior?.bakedPulse)
      return
    }
    if (instance instanceof Hamt) {
      await this.#updateHamt(instance, prior)
      await this.#yield()
      return
    }
    if (instance instanceof Dmz) {
      await this.#updateCovenant(instance, prior)
      await this.#yield()
    }
    const { classMap = {}, defaultClass } = instance.constructor
    assert(!(Object.keys(classMap).length && defaultClass))
    await Promise.all(
      Object.keys(classMap).map(async (key) => {
        const value = instance[key]
        await this.#bake(value, prior?.[key])
      })
    )
    if (defaultClass) {
      const values = []
      const priorValues = []
      for (const [key, value] of Object.entries(instance)) {
        values.push(value)
        priorValues.push(prior?.[key])
      }
      await this.#bake(values, priorValues)
    }
  }
  async #updateCovenant(dmz, prior) {
    // TODO allow slow resolution to not block the rest of the bake
    // TODO is there a point to bake the covenant pulse too ?
    assert(dmz instanceof Dmz)
    assert(!prior || prior instanceof Dmz)
    if (dmz.bakedCovenant) {
      return
    }
    const path = dmz.getCovenantPath()
    const priorPath = prior?.getCovenantPath()

    if (path === priorPath) {
      dmz.bake(prior.bakedCovenant)
      return
    }
    const covenantPulse = await this.#covenantResolver(path)
    dmz.bake(covenantPulse)
  }
  async #updateHamt(hamt, prior) {
    assert(hamt instanceof Hamt)
    assert(!prior || prior instanceof Hamt)
    if (hamt.isBakeSkippable) {
      return
    }
    let map = prior?.bakedMap ?? Immutable.Map()
    hamt.bake(map)
    const diff = await hamt.compare(prior)
    const { added, deleted, modified } = diff
    assert(map instanceof Immutable.Map)
    for (const key of deleted) {
      map = map.delete(key)
      hamt.bake(map)
      await this.#yield()
    }
    const set = async (key, value) => {
      map = map.set(key, value)
      hamt.bake(map)
      await this.#yield()
    }
    const mods = [...modified].map(async (key) => {
      const value = await hamt.get(key)
      await set(key, value)
      let priorValue
      if (prior) {
        if (prior.bakedMap.has(key)) {
          priorValue = prior.bakedMap.get(key)
        } else {
          priorValue = await prior.get(key)
        }
      }
      await this.#bake(value, priorValue)
    })
    const adds = [...added].map(async (key) => {
      const value = await hamt.get(key)
      await set(key, value)
      await this.#bake(value)
    })
    await Promise.all([...mods, ...adds])
  }
  #yield(isDeepLoaded = false) {
    return throttledYield(() => this.#yieldRaw(isDeepLoaded))
  }
  async #yieldRaw(isDeepLoaded = false) {
    debug('creating crisp for pulse %s', this.#pulse)
    // TODO include the prievous crisp in the new crisp
    // TODO only yield if something useful occured, like new child or state
    const crisp = Crisp.createRoot(
      this.#pulse,
      this.#actions,
      this.#chroot,
      isDeepLoaded
    )
    this.#crisp = crisp
    for (const subscriber of this.#subscribers) {
      subscriber.push(crisp)
    }
    // delay to allow thread a break to hopefully help react renders
    await delay(10)
  }
  subscribe() {
    const subscriber = pushable({
      objectMode: true,
      onEnd: () => this.#subscribers.delete(subscriber),
    })
    this.#subscribers.add(subscriber)
    if (this.#crisp) {
      subscriber.push(this.#crisp)
    }
    return subscriber
  }
  set concurrency(value) {
    assert(Number.isInteger(value))
    assert(value > 0, 'concurrency must be greater than 0')
    this.#concurrency = value
    this.#tickle()
  }
}

const throttledYield = throttle((fn) => fn(), 200, {
  leading: false,
  trailing: true,
})
