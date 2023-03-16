import parallel from 'it-parallel'
import { pipe } from 'it-pipe'
import assert from 'assert-fast'
import posix from 'path-browserify'
import Debug from 'debug'
import { Pulse, PulseLink } from '../../w008-ipld'
import { Crisp } from '..'
import { BakeCache } from './BakeCache'
import Immutable from 'immutable'
import { pushable } from 'it-pushable'

const debug = Debug('interblock:api:Syncer')
const BAKE_TEAR = 'BAKE_TEAR'

export class Syncer {
  #concurrency = 20
  #pulse
  #pulseResolver
  #covenantResolver
  #actions
  #chroot

  #subscribers = new Set()
  #abort = new AbortController()
  #crisp
  #isDeepLoaded = false
  #bakeQueue
  #yieldQueue = pushable({ objectMode: true })
  #cache = BakeCache.create(this.#yieldQueue)

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
    syncer.#crisp = Crisp.createLoading(chroot)
    syncer.#startYieldQueue()
    return syncer
  }
  async update(fullPulse) {
    assert(fullPulse instanceof Pulse)
    const pulse = fullPulse.getPulseLink()
    assert(!pulse.cid.equals(this.#pulse?.cid), `identical update ${pulse}`)
    this.#tearBake(pulse)
    const prior = this.#pulse
    this.#pulse = pulse

    try {
      this.#pulseBake(pulse, prior)
      await this.#drainBakeQueue()
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
  #tearBake(nextPulse) {
    debug('tearing bake for %s in favour of %s', this.#pulse, nextPulse)
    this.#bakeQueue?.throw(new Error(BAKE_TEAR))
    this.#bakeQueue = pushable({ objectMode: true })
    this.#abort?.abort('tear bake')
    this.#abort = new AbortController()
  }
  #pulseBake(pulse, prior) {
    assert(pulse instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    assert(!this.#cache.hasPulse(pulse), `already baked: ${pulse}`)
    this.#cache.initialize(pulse)
    if (prior) {
      if (this.#cache.hasChildren(prior)) {
        const children = this.#cache.getChildren(prior)
        this.#cache.updateChildren(pulse, children)
      }
    }
    this.#bakeQueue.push({ pulse, prior })
  }
  async #drainBakeQueue() {
    const queue = this.#bakeQueue
    const abort = this.#abort
    try {
      for await (const { pulse, prior } of queue) {
        // TODO allow parallel walks
        assert(pulse instanceof PulseLink)
        assert(!prior || prior instanceof PulseLink)
        const fullPulse = await this.#resolve(pulse, abort)
        this.#cache.setPulse(pulse, fullPulse)
        await this.#bake(fullPulse, prior, abort)
        if (this.#bakeQueue === queue && queue.readableLength === 0) {
          this.#isDeepLoaded = true
          this.#yieldQueue.push({ type: 'DEEP_LOADED' })
          queue.end()
          debug('bake queue drained for %s', this.#pulse, this.#crisp)
        }
      }
    } catch (error) {
      if (error.message !== BAKE_TEAR) {
        if (error.message !== 'Endurance is stopped') {
          throw error
        }
      }
    }
  }
  async #resolve(pulse, abort) {
    assert(pulse instanceof PulseLink)
    assert(abort instanceof AbortController)
    const TYPE = 'crispDeepPulse'
    const fullPulse = await this.#pulseResolver(pulse, TYPE, abort)
    if (abort.signal.aborted) {
      throw new Error(BAKE_TEAR)
    }
    return fullPulse
  }
  async #resolveCovenant(covenantPath, abort) {
    assert.strictEqual(typeof covenantPath, 'string')
    assert(abort instanceof AbortController)
    const covenant = await this.#covenantResolver(covenantPath, abort)
    if (abort.signal.aborted) {
      throw new Error(BAKE_TEAR)
    }
    return covenant
  }
  async #bake(fullPulse, prior, abort) {
    assert(fullPulse instanceof Pulse)
    assert(!prior || prior instanceof PulseLink)
    assert(abort instanceof AbortController)

    const covenantPath = fullPulse.getCovenantPath()
    if (!this.#cache.hasCovenant(covenantPath)) {
      const covenant = await this.#resolveCovenant(covenantPath, abort)
      this.#cache.setCovenant(covenantPath, covenant)
    }

    let nextChildren = Immutable.Map()
    const pulse = fullPulse.getPulseLink()
    let children =
      this.#cache.hasChildren(pulse) && this.#cache.getChildren(pulse)
    const network = fullPulse.getNetwork()
    for await (const [alias, channelId] of network.children.entries()) {
      if (abort.signal.aborted) {
        debug('bake aborted during hamt walk for %s', pulse)
        throw new Error(BAKE_TEAR)
      }
      const channel = await get(network.channels, channelId, abort)
      if (channel.rx.latest) {
        const { latest } = channel.rx
        if (!this.#cache.hasPulse(latest)) {
          let priorLatest
          if (prior && this.#cache.hasPulse(prior)) {
            const fullPrior = this.#cache.getPulse(prior)
            const priorNetwork = fullPrior.getNetwork()
            const pc = await get(priorNetwork.channels, channelId, abort)
            priorLatest = pc.rx.latest
          }
          if (!this.#cache.hasPulse(latest)) {
            // TODO handle race conditions if latest already in the bake queue
            // probably handle at the same time as prioritizing the queue
            this.#pulseBake(latest, priorLatest)
          }
        }
        nextChildren = nextChildren.set(alias, latest)
        if (children) {
          children = children.set(alias, latest)
          this.#cache.updateChildren(pulse, children)
        } else {
          this.#cache.updateChildren(pulse, nextChildren)
        }
      }
    }
    this.#cache.updateChildren(pulse, nextChildren)
  }
  async #startYieldQueue() {
    for await (const { type } of this.#yieldQueue) {
      const pulse = this.#pulse
      const actions = this.#actions
      const chroot = this.#chroot
      const cache = this.#cache
      const isDeepLoaded = this.#isDeepLoaded
      this.#crisp = Crisp.createRoot(
        pulse,
        actions,
        chroot,
        cache,
        isDeepLoaded
      )
      for (const subscriber of this.#subscribers) {
        subscriber.push(this.#crisp)
      }
    }
  }
  subscribe() {
    const subscriber = pushable({
      objectMode: true,
      onEnd: () => this.#subscribers.delete(subscriber),
    })
    this.#subscribers.add(subscriber)
    subscriber.push(this.#crisp)
    return subscriber
  }
  set concurrency(value) {
    assert(Number.isInteger(value))
    assert(value > 0, 'concurrency must be greater than 0')
    this.#concurrency = value
  }
}
async function get(hamt, channelId, abort) {
  const channel = await hamt.getChannel(channelId)
  if (abort.signal.aborted) {
    throw new Error(BAKE_TEAR)
  }
  return channel
}
