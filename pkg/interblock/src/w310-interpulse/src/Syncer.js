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
  #concurrency = 10
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
    const syncer = this
    let taskCounter = 0
    const tasker = async function* (queue) {
      for await (const { address, pulseId } of queue) {
        taskCounter++
        yield () => syncer.#processor(address, pulseId, abort)
      }
    }
    const concurrency = this.#concurrency
    const propeller = (source) => parallel(source, { concurrency })
    return new Promise((resolve, reject) => {
      pipe(queue, tasker, propeller, async (source) => {
        try {
          for await (const _ of source) {
            taskCounter--
            if (this.#bakeQueue === queue && taskCounter === 0) {
              this.#isDeepLoaded = true
              this.#yieldQueue.push({ type: 'DEEP_LOADED' })
              queue.end()
              debug('bake queue drained for %s', this.#pulseId, this.#crisp)
            }
          }
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  }
  async #processor(address, pulseId, abort) {
    assert(address instanceof Address)
    assert(pulseId instanceof PulseLink)
    assert(abort instanceof AbortController)
    checkAbort(abort)
    if (this.#cache.isBaked(address, pulseId)) {
      return
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
  }

  async #resolve(pulseId, abort) {
    assert(pulseId instanceof PulseLink)
    assert(abort instanceof AbortController)
    const TYPE = 'crispDeepPulse'
    const pulse = await this.#pulseResolver(pulseId, TYPE, abort)
    checkAbort(abort)
    return pulse
  }
  #covenantResolveMap = new Map() // covenantPath -> promise
  async #resolveCovenant(covenantPath, abort) {
    assert.strictEqual(typeof covenantPath, 'string')
    assert(abort instanceof AbortController)
    if (!this.#covenantResolveMap.has(covenantPath)) {
      const promise = new Promise((resolve, reject) => {
        this.#covenantResolver(covenantPath, abort)
          .then((covenant) => {
            checkAbort(abort)
            this.#cache.setCovenant(covenantPath, covenant)
            resolve()
          })
          .catch(reject)
      })

      this.#covenantResolveMap.set(covenantPath, promise)
    }
    return await this.#covenantResolveMap.get(covenantPath)
  }
  async #bake(address, pulse, abort) {
    assert(address instanceof Address)
    assert(pulse instanceof Pulse)
    assert(abort instanceof AbortController)
    const covenantPath = pulse.getCovenantPath()
    let covenantPromise
    if (!this.#cache.hasCovenant(covenantPath)) {
      covenantPromise = this.#resolveCovenant(covenantPath, abort)
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
          // TODO update the size of children if we have it for skeletons
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
    await covenantPromise
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
      // throttling here has no observable affect
      this.#crisp = Crisp.createRoot(...args)
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
const checkAbort = (abort) => {
  assert(abort instanceof AbortController)
  if (abort.signal.aborted) {
    throw new Error(abort.message || `aborted`)
  }
}
