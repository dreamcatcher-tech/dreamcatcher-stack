import parallel from 'it-parallel'
import { pipe } from 'it-pipe'
import throttle from 'lodash.throttle'
import assert from 'assert-fast'
import posix from 'path-browserify'
import Debug from 'debug'
import { Address, Pulse, PulseLink } from '../../w008-ipld'
import { Crisp } from '..'
import { BakeCache } from './BakeCache'
import Immutable from 'immutable'
import { pushable } from 'it-pushable'

const debug = Debug('interblock:api:Syncer')
const BAKE_TEAR = 'BAKE_TEAR'

export class Syncer {
  #concurrency = 20
  #address
  #pulseId
  #pulseResolver
  #covenantResolver
  #actions
  #chroot

  #subscribers = new Set()
  #abort
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
  async update(pulse) {
    assert(pulse instanceof Pulse)
    if (!this.#address) {
      this.#address = pulse.getAddress()
    } else {
      assert(this.#address.equals(pulse.getAddress()))
    }
    const pulseId = pulse.getPulseLink()
    assert(!pulseId.equals(this.#pulseId), `identical update ${pulseId}`)
    this.#tearBake(pulseId)
    this.#pulseId = pulseId

    try {
      const address = pulse.getAddress()
      this.#treeBake(address, pulseId)
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
    debug('tearing bake for %s in favour of %s', this.#pulseId, nextPulse)
    this.#bakeQueue?.throw(new Error(BAKE_TEAR))
    this.#bakeQueue = pushable({ objectMode: true })
    this.#abort?.abort('tear bake')
    this.#abort = new AbortController()
    this.#abort.message = BAKE_TEAR
    this.#isDeepLoaded = false
  }
  #treeBake(address, pulseId) {
    assert(address instanceof Address)
    assert(pulseId instanceof PulseLink)
    this.#cache.preBake(address, pulseId)
    this.#bakeQueue.push({ address, pulseId })
    // assumes that in a given tree there is exactly one pulseId per address
    // this is false when we allow snapshots
  }
  async #drainBakeQueue() {
    const queue = this.#bakeQueue
    const abort = this.#abort
    for await (const { address, pulseId } of queue) {
      assert(address instanceof Address)
      assert(pulseId instanceof PulseLink)
      if (this.#cache.isBaked(address, pulseId)) {
        continue
      }
      let pulse
      if (this.#cache.hasPulse(address)) {
        const lastPulse = this.#cache.getPulse(address)
        assert(lastPulse instanceof Pulse)
        if (lastPulse.getPulseLink().equals(pulseId)) {
          pulse = lastPulse
        }
      }
      if (!pulse) {
        pulse = await this.#resolve(pulseId, abort)
      }
      if (this.#cache.isVirgin(address)) {
        this.#cache.setVirginPulse(address, pulse)
      }
      await this.#bake(address, pulse, abort)
      if (this.#bakeQueue === queue && queue.readableLength === 0) {
        this.#isDeepLoaded = true
        this.#yieldQueue.push({ type: 'DEEP_LOADED' })
        queue.end()
        debug('bake queue drained for %s', this.#pulseId, this.#crisp)
      }
    }
  }
  async #resolve(pulseId, abort) {
    assert(pulseId instanceof PulseLink)
    assert(abort instanceof AbortController)
    const TYPE = 'crispDeepPulse'
    const pulse = await this.#pulseResolver(pulseId, TYPE, abort)
    if (abort.signal.aborted) {
      throw new Error(BAKE_TEAR)
    }
    return pulse
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
  async #bake(address, pulse, abort) {
    assert(address instanceof Address)
    assert(pulse instanceof Pulse)
    assert(abort instanceof AbortController)
    const covenantPath = pulse.getCovenantPath()
    if (!this.#cache.hasCovenant(covenantPath)) {
      // TODO multithread this
      const covenant = await this.#resolveCovenant(covenantPath, abort)
      this.#cache.setCovenant(covenantPath, covenant)
    }

    let channels = Immutable.Map()
    let prior
    if (this.#cache.isDone(address)) {
      prior = this.#cache.getPulse(address)
      channels = this.#cache.getChannels(address)
    }
    const network = pulse.getNetwork()
    const priorNet = prior?.getNetwork()
    const start = Date.now()

    const [deleted, dIterator] = await network.diffChannels(priorNet, abort)
    const diff = Date.now() - start
    const dstart = Date.now()
    for (const channelId of deleted) {
      assert(Number.isInteger(channelId))
      channels = channels.delete(channelId)
    }
    const deletes = Date.now() - dstart
    const istart = Date.now()
    for await (const channel of dIterator) {
      channels = channels.set(channel.channelId, channel)
      const latest = channel.rx.latest && PulseLink.parse(channel.rx.latest)

      if (latest) {
        const [alias] = channel.aliases // TODO fix alias model
        if (!alias || alias === '.' || alias === '..') {
          continue
        }
        const address = Address.fromCID(channel.address)
        this.#treeBake(address, latest)
        // if not done, updates, else ignores
        if (!this.#cache.isDone(address)) {
          // this.#cache.updateChannels(address, channels)
        }
      }
    }
    const inserts = Date.now() - istart
    if (channels.size > 10) {
      debug(
        'diff took %dms, %dms deletes, %dms inserts for size %i',
        diff,
        deletes,
        inserts,
        channels.size
      )
    }

    this.#cache.finalize(address, pulse, channels)
  }
  async #startYieldQueue() {
    for await (const { type } of this.#yieldQueue) {
      const address = this.#address
      // crisp should defer its pulse until asked for it
      const actions = this.#actions
      const chroot = this.#chroot
      const cache = this.#cache
      const isDeepLoaded = this.#isDeepLoaded
      const args = [address, actions, chroot, cache, isDeepLoaded]
      // throttled(() => {
      this.#crisp = Crisp.createRoot(...args)
      for (const subscriber of this.#subscribers) {
        subscriber.push(this.#crisp)
      }
      // })
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
const throttled = throttle((fn) => fn(), 100)
