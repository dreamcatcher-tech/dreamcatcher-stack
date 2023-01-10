import { pipe } from 'it-pipe'
import { shell } from '../../w212-system-covenants'
import * as apps from '../../w301-user-apps'
import { pushable } from 'it-pushable'
import { Engine, Endurance } from '../../w210-engine'
import { schemaToFunctions } from '../../w002-api'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { PulseNet } from '../../w305-libp2p'
import { NetEndurance } from './NetEndurance'
import { Crypto } from '../../w210-engine/src/Crypto'
import { PulseLink } from '../../w008-ipld/index.mjs'
import { isBrowser, isNode } from 'wherearewe'

const debug = Debug('interpulse')

/**
 * The top level ORM object.
 * Assembles an Engine with all the services it needs to operate.
 *    Where networking is started.
 *    Where multithreading is controlled.
 * Wraps engine with useful functions for devs.
 * Loads the shell to be loaded at the root block.
 * Works with paths, whereas engine works with addresses.
 * Manages subscriptions to remote chains.
 */

export class Interpulse {
  net
  #repo
  #engine
  #endurance
  #crypto
  #subscribers = new Set()

  static async createCI(options = {}) {
    options = { ...options, CI: true }
    return this.create(options)
  }
  static async create(options = {}) {
    let overloads = options.overloads ? { ...options.overloads } : {}
    overloads.root = shell
    Object.assign(overloads, apps)
    // if announcer is inside net, how to trigger on interpulse received ?
    // could connect via Interpulse ?
    let { net, crypto, endurance = Endurance.create() } = options
    const { repo, CI } = options
    if (repo) {
      // no repo => no net - storage and network are one 🙏
      const { tcpHost, tcpPort } = options
      net = await PulseNet.create(repo, CI, tcpHost, tcpPort)
      crypto = Crypto.create(net.keypair)
      endurance = await NetEndurance.create(net)
    }
    const opts = { ...options, overloads, crypto, endurance }
    const engine = await Engine.create(opts)

    const instance = new Interpulse(engine)
    instance.#endurance = endurance
    if (repo) {
      instance.net = net
      instance.#repo = repo
      instance.#crypto = crypto
      instance.#watchMtab()
    }
    return instance
  }
  constructor(engine) {
    assert(engine instanceof Engine)
    const actions = mapShell(engine)
    Object.assign(this, actions)
    this.#engine = engine
  }
  async pierce(request) {
    return await this.#engine.pierce(request)
  }
  async actions(path = '.') {
    const pulse = await this.latest(path)
    const covenantPath = pulse.getCovenantPath()
    const covenantPulse = await this.latest(covenantPath)
    const state = covenantPulse.getState().toJS()
    const { api = {} } = state
    const actions = schemaToFunctions(api)
    const dispatches = {}
    for (const key of Object.keys(actions)) {
      dispatches[key] = (payload) => {
        const action = actions[key](payload)
        return this.dispatch(action, path)
      }
    }
    return dispatches
  }
  async latest(path = '.') {
    const { wd } = this
    const absPath = posix.resolve(wd, path)
    for await (const pulse of this.#engine.subscribe()) {
      debug('latest pulse for', path, pulse.getPulseLink())
      try {
        const latest = await this.#engine.latestByPath(absPath, pulse)
        return latest
      } catch (error) {
        debug('latest error', error.message)
      }
    }
  }
  /**
   * Get whatever pulse is available in local storage for the given path.
   * Will error if no pulse is available.
   * @param {string} path Path to requested pulse relative to rootPulse
   * @param {Pulse} rootPulse Pulse to be treated as root for the path
   * @returns Pulse
   */
  async current(path = '.', rootPulse) {
    const { wd } = this
    const absPath = posix.resolve(wd, path)
    const latest = await this.#engine.latestByPath(absPath, rootPulse)
    return latest
  }
  get pulseResolver() {
    return (pulseLink) => this.#endurance.recover(pulseLink)
  }
  get logger() {
    return this.#engine.logger
  }
  get wd() {
    const { wd = '/' } = this.#engine.selfLatest.getState().toJS()
    return wd
  }
  async hardReset() {
    await this.stop()
    if (isBrowser) {
      const dbs = await window.indexedDB.databases()
      const awaits = []
      for (const db of dbs) {
        debug(`deleting`, db)
        const request = window.indexedDB.deleteDatabase(db.name)
        awaits.push(
          new Promise((resolve, reject) => {
            request.onerror = reject
            request.onsuccess = resolve
          }).then(() => debug(`deleted`, db))
        )
      }
      return await Promise.all(awaits)
    }
    if (isNode) {
      if (typeof this.#repo === 'string') {
        debug('deleting directory:', this.#repo)
        const { default: rimraf } = await import('rimraf')

        // sync to purposefully block the thread from any block making
        return rimraf.sync(this.#repo)
      }
      debug('repo was not a filesystem path - skipping deletion')
    }
  }
  async scrub() {
    /**
    To ensure the integrity of the system, invoke scrub to
    check the hashes of all objects at this location,
    and to verify the availability of all objects.
    Use the option --history to check all blocks in the past
    as well as LATEST.  This will incur significant usage fees
    and bandwidth.
     */
    throw new Error('not implemented')
  }
  async startNetwork() {
    if (this.net) {
      await this.net.start()
    }
  }
  async stop() {
    if (this.net) {
      this.#crypto.stop()
      await this.#endurance.stop() // complete all disk writes
      await this.net.stop()
    }
    await this.#engine.stop() // stop all interpulsing
  }
  async stats() {
    if (!this.net) {
      return {}
    }
    return await this.net.stats()
  }
  subscribe(path = '.') {
    // receive a continuous stream of pulses from a given path
    const { wd } = this
    const absPath = posix.resolve(wd, path)
    debug('subscribing to', absPath)
    const sink = pushable({
      objectMode: true,
      onEnd: () => {
        debug('unsubscribe', absPath)
        this.#subscribers.delete(sink)
      },
    })
    this.#subscribers.add(sink)
    const rootEmitter = this.#engine.subscribe()
    const checker = async (source) => {
      let prior
      for await (const rootPulse of source) {
        debug('checker pulse %s', rootPulse.getPulseLink())
        try {
          const latest = await this.#engine.latestByPath(absPath, rootPulse)
          if (prior?.cid.equals(latest.cid)) {
            continue
          }
          prior = latest
          sink.push(latest)
        } catch (error) {
          debug('error', error.message)
        }
      }
    }
    pipe(rootEmitter, checker)
    return sink
  }
  /**
   * get the latest mtab pulse, then:
   *    get the new multi addresses
   *    get the new address mappings
   *    get the new hardlinks
   */
  async #watchMtab() {
    assert(this.net)
    const subscribed = new Set()
    const multiaddrsSet = new Set()
    let lastMtab
    for await (const mtab of this.subscribe('/.mtab')) {
      if (lastMtab) {
        // TODO determine what to unsubscribe and unmap
      }
      const state = mtab.getState().toJS()
      debug('mtab state', state)
      debug('mtab hash', mtab.cid.toString())
      const peerIds = Object.keys(state)
      for (const peerId of peerIds) {
        const { multiaddrs, chainIds } = state[peerId]
        for (const multiaddr of multiaddrs) {
          if (!multiaddrsSet.has(multiaddr)) {
            multiaddrsSet.add(multiaddr)
            await this.net.addMultiAddress(multiaddr)
          }
        }
        for (const chainId of chainIds) {
          this.net.addAddressPeer(chainId, peerId)
        }
      }

      lastMtab = mtab
      const { hardlinks, channels } = mtab.getNetwork()
      for await (const [, channelId] of hardlinks.entries()) {
        const channel = await channels.getChannel(channelId)
        const { address } = channel
        if (subscribed.has(address.getChainId())) {
          continue
        }
        subscribed.add(address.getChainId())
        debug('subscribing to', address)

        const stream = this.net.subscribePulse(address)
        const updater = async (source) => {
          for await (const pulselink of source) {
            assert(pulselink instanceof PulseLink)
            const latest = await this.#endurance.recover(pulselink)
            const target = mtab.getAddress()
            await this.#engine.updateLatest(target, latest)
          }
        }
        pipe(stream, updater)
      }
    }
  }
  get isCreated() {
    return !this.net || this.net.isCreated
  }
}
const mapShell = (engine) => {
  const actions = {}
  const api = schemaToFunctions(shell.api)
  for (const key of Object.keys(api)) {
    actions[key] = (...args) => {
      const action = api[key](...args)
      return engine.pierce(action)
    }
  }
  const { publish } = actions
  assert(publish)
  actions.publish = (name, covenant = {}, parentPath = '.') => {
    // TODO use the covenant schema to pluck out what is valid
    // or by default strip out any functions
    const { reducer, ...rest } = covenant
    return publish(name, rest, parentPath)
  }
  return actions
}
