import parallel from 'it-parallel'
import { pipe } from 'it-pipe'
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
const BAKE_TEAR = 'BAKE_TEAR'

export class Syncer {
  #concurrency = 20
  #pulseResolver
  #covenantResolver
  #actions
  #chroot
  #pulse
  #subscribers = new Set()
  #abort = new AbortController()
  #crisp = Crisp.createLoading()
  #bakeQueue = pushable({ objectMode: true })
  #yieldQueue = pushable({ objectMode: true })
  #totallyBaked = Promise.resolve()

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
    syncer.#startYieldQueue()
    return syncer
  }
  async update(pulse) {
    assert(pulse instanceof Pulse)
    assert(!pulse.cid.equals(this.#pulse?.cid))
    this.#tearBake()

    // TODO assert lineage matches
    // TODO permit skips in lineage
    const prior = this.#pulse
    // TODO split the bake cache so pulse does not have to be reference equal

    // priors should walk back to the last one we had data on, not tears
    try {
      this.#pulse = await this.#resolve(pulse.getPulseLink())
      this.#totallyBaked = this.#startBakeQueue()
      this.#pulseBake(pulse.getPulseLink(), prior?.getPulseLink())
      await this.#totallyBaked
    } catch (error) {
      if (error.message === BAKE_TEAR) {
        debug('bake queue torn')
      } else if (error.message === 'Endurance is stopped') {
        debug('endurance stopped')
      } else {
        throw error
      }
    }
  }
  get awaitDeepLoad() {
    return this.#totallyBaked
  }
  #tearBake() {
    debug('tearing bake for %s', this.#pulse)
    this.#bakeQueue?.throw(new Error(BAKE_TEAR))
    this.#bakeQueue = undefined
    this.#abort?.abort('tear bake')
  }
  /**
   * Will mutate instance and all children of instance
   * by expanding any PulseLinks to Pulses, and any Hamts to Maps.
   * @param {IpldInterface | [IpldInterface]} instance
   */
  async #pulseBake(pulse, prior) {
    assert(pulse instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    // bakes pulses one at a time, so we load breadth first
    this.#bakeQueue.push({ pulse, prior })
  }

  async #startBakeQueue() {
    assert(!this.#bakeQueue)
    const queue = pushable({ objectMode: true })
    const abort = new AbortController()
    this.#bakeQueue = queue
    this.#abort = abort
    return new Promise((resolve, reject) => {
      const drain = async () => {
        try {
          for await (const { pulse, prior } of queue) {
            // TODO allow parallel walks
            assert(pulse instanceof PulseLink)
            assert(!pulse.bakedPulse)
            assert(!prior || prior instanceof PulseLink)
            const fullPulse = await this.#resolve(pulse, abort)
            pulse.bake(fullPulse)
            await this.#yield()
            await this.#bake(pulse.bakedPulse, prior?.bakedPulse, abort)

            if (this.#bakeQueue === queue && queue.readableLength === 0) {
              // maybe should only yield once a new pulse has been baked ?
              // not *that* useful to yield partial hamts
              const isDeepLoaded = true
              await this.#yield(isDeepLoaded)
              queue.end()
            }
          }
        } catch (error) {
          if (error.message !== BAKE_TEAR) {
            if (error.message !== 'Endurance is stopped') {
              return reject(error)
            }
          }
        }
        resolve()
      }
      drain()
    })
  }
  async #resolve(pulseLink, abort) {
    assert(pulseLink instanceof PulseLink)
    const pulse = await this.#pulseResolver(pulseLink, TYPE, abort)
    return pulse
  }
  async #bake(instance, prior, abort) {
    assert(abort instanceof AbortController)
    if (abort.signal.aborted) {
      return
    }
    if (Array.isArray(instance)) {
      assert(!prior || Array.isArray(prior))
      return await Promise.all(
        instance.map((v, i) => this.#bake(v, prior?.[i], abort))
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
      this.#pulseBake(instance, prior)
      return
    }
    if (instance instanceof Hamt) {
      await this.#updateHamt(instance, prior, abort)
      await this.#yield()
      return
    }
    if (instance instanceof Dmz) {
      await this.#updateCovenant(instance, prior)
      await this.#yield()
    }
    const { classMap = {}, defaultClass } = instance.constructor
    assert(!(Object.keys(classMap).length && defaultClass))

    if (defaultClass) {
      const values = []
      const priorValues = []
      for (const [key, value] of Object.entries(instance)) {
        values.push(value)
        priorValues.push(prior?.[key])
      }
      await this.#bake(values, priorValues, abort)
    } else {
      await Promise.all(
        Object.keys(classMap).map(async (key) => {
          const value = instance[key]
          await this.#bake(value, prior?.[key], abort)
        })
      )
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
  async #updateHamt(hamt, prior, abort) {
    assert(hamt instanceof Hamt)
    assert(!prior || prior instanceof Hamt)
    assert(abort instanceof AbortController)
    if (abort.signal.aborted) {
      return
    }
    if (hamt.isBakeSkippable) {
      return
    }
    let map = hamt.bakedMap ?? prior?.bakedMap ?? Immutable.Map()
    hamt.bake(map)
    const start = Date.now()
    const diff = await hamt.compare(prior) // this definitely locks the event loop
    if (Date.now() - start > 1000) {
      console.log('slow compare', Date.now() - start)
    }
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
    // TODO queue these using emitter hamt walker
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
      await this.#bake(value, priorValue, abort)
    })
    const adds = [...added].map(async (key) => {
      const value = await hamt.get(key)
      await set(key, value)
      await this.#bake(value, undefined, abort)
    })
    await Promise.all([...mods, ...adds])
  }
  async #yield(isDeepLoaded = false) {
    const pulse = this.#pulse
    const actions = this.#actions
    const chroot = this.#chroot
    const args = { pulse, actions, chroot, isDeepLoaded }
    this.#yieldQueue.push(args)
  }
  async #startYieldQueue() {
    for await (const args of this.#yieldQueue) {
      this.#yieldRaw(args)
    }
  }
  #yieldRaw({ pulse, actions, chroot, isDeepLoaded }) {
    // TODO include the prievous crisp in the new crisp
    // TODO only yield if something useful occured, like new child or state
    const crisp = Crisp.createRoot(pulse, actions, chroot, isDeepLoaded)
    this.#crisp = crisp
    for (const subscriber of this.#subscribers) {
      subscriber.push(crisp)
    }
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
  }
}

class BakeCache {
  #pulses = new Map() // cids -> pulse
  #covenants = new Map() // paths -> pulse
  static create() {
    return new BakeCache()
  }
  getCovenant(path) {
    assert(posix.isAbsolute(path), `path must be absolute: ${path}`)
    return this.#covenants.get(path)
  }
  getPulse(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    return this.#pulses.get(pulseLink.cid.toString())
  }
}
