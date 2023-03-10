import parallel from 'it-parallel'
import { pipe } from 'it-pipe'
import { eventLoopSpinner } from 'event-loop-spinner'
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
  #loadedCrisp
  #bakeQueue = pushable({ objectMode: true })

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
    this.#tearBakeQueue()

    // TODO assert lineage matches
    // TODO permit skips in lineage
    const prior = this.#pulse
    this.#pulse = pulse
    const totallyBaked = this.#startBakeQueue()
    this.#pulseBake(pulse.getPulseLink(), prior?.getPulseLink())
    await totallyBaked
  }
  #tearBakeQueue() {
    this.#bakeQueue.return(new Error(BAKE_TEAR))
    this.#bakeQueue = undefined
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
    this.#bakeQueue = pushable({ objectMode: true })
    return new Promise((resolve, reject) => {
      const drain = async () => {
        try {
          for await (const { pulse, prior } of this.#bakeQueue) {
            assert(pulse instanceof PulseLink)
            assert(!pulse.bakedPulse)
            assert(!prior || prior instanceof PulseLink)
            debug('bakeQueue length', this.#bakeQueue.readableLength + 1)
            const fullPulse = await this.#resolve(pulse)
            debug('pulse resolved %s', pulse)
            pulse.bake(fullPulse)
            await this.#yield()
            await this.#bake(pulse.bakedPulse, prior?.bakedPulse)

            if (this.#bakeQueue.readableLength === 0) {
              this.#bakeQueue.end()
            }
          }
          // maybe should only yield once a new pulse has been baked ?
          // not *that* useful to yield partial hamts
          const isDeepLoaded = true
          await this.#yield(isDeepLoaded)
        } catch (error) {
          if (error.message !== BAKE_TEAR) {
            return reject(error)
          }
        }
        resolve()
      }
      drain()
    })
  }
  async #resolve(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const pulse = await this.#pulseResolver(pulseLink, TYPE, this.#abort)
    return pulse
  }
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
      this.#pulseBake(instance, prior)
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
    // maybe these should be queued and throttled
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
  async #yield(isDeepLoaded = false) {
    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin()
    }
    return throttledYield(() => this.#yieldRaw(isDeepLoaded))
  }
  async #yieldRaw(isDeepLoaded = false) {
    // TODO include the prievous crisp in the new crisp
    // TODO only yield if something useful occured, like new child or state
    const crisp = Crisp.createRoot(
      this.#pulse,
      this.#actions,
      this.#chroot,
      isDeepLoaded
    )
    this.#crisp = crisp
    if (this.#loadedCrisp && !isDeepLoaded) {
      return
    }
    if (isDeepLoaded) {
      this.#loadedCrisp = crisp
    }
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
    if (this.#loadedCrisp) {
      subscriber.push(this.#loadedCrisp)
    } else if (this.#crisp) {
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

const throttledYield = throttle((fn) => fn(), 200, {
  leading: false,
  trailing: true,
})
