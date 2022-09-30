import { pipe } from 'it-pipe'
import { shell } from '../../w212-system-covenants'
import { pushable } from 'it-pushable'
import { getCovenantState } from '../../w023-system-reducer'
import { Engine, schemaToFunctions } from '../../w210-engine'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { PulseNet } from '../../w305-libp2p'
import { NetEndurance } from './NetEndurance'
import { Crypto } from '../../w210-engine/src/Crypto'
import { PulseLink } from '../../w008-ipld'

const debug = Debug('interpulse')

/**
 *
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
    // if announcer is inside net, how to trigger on interpulse received ?
    // could connect via Interpulse ?
    let { net, crypto, endurance } = options
    const { repo, CI } = options
    if (repo) {
      // no repo => no net - storage and network are one 🙏
      net = await PulseNet.create(repo, CI)
      crypto = Crypto.create(net.keypair)
      endurance = await NetEndurance.create(net)
    }
    const opts = { ...options, overloads, crypto, endurance }
    const engine = await Engine.create(opts)

    const instance = new Interpulse(engine)
    if (repo) {
      instance.net = net
      instance.#endurance = endurance
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
  async actions(path = '.') {
    const latest = (path) => this.latest(path)
    const state = await getCovenantState(path, latest)
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
      debug('pulse', pulse.getPulseLink())
      try {
        const latest = await this.#engine.latestByPath(absPath, pulse)
        return latest
      } catch (error) {
        debug('error', error.message)
      }
    }
  }
  async isResolvablePath(path) {
    // TODO test if this path may be resolved at some point
    // basically walk until hit an unresolved address or non-existent channel
  }
  get logger() {
    return this.#engine.logger
  }
  get wd() {
    const { wd = '/' } = this.#engine.selfLatest.getState().toJS()
    return wd
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
        debug('unsubscribe')
        this.#subscribers.delete(sink)
      },
    })
    this.#subscribers.add(sink)
    const rootEmitter = this.#engine.subscribe()
    const checker = async (source) => {
      for await (const rootPulse of source) {
        debug('checker pulse', rootPulse.getPulseLink())
        try {
          const latest = await this.#engine.latestByPath(absPath, rootPulse)
          sink.push(latest)
        } catch (error) {
          debug('error', error.message)
        }
      }
    }
    pipe(rootEmitter, checker)
    return sink
  }
  async #watchMtab() {
    assert(this.net)
    const subscribed = new Set()
    let lastMtab
    for await (const mtab of this.subscribe('/.mtab')) {
      if (lastMtab) {
        // TODO determine what to unmount
      }
      lastMtab = mtab
      const network = mtab.getNetwork()
      for await (const [, channelId] of network.hardlinks.entries()) {
        const channel = await network.channels.getChannel(channelId)
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
    const { reducer, ...rest } = covenant
    return publish(name, rest, parentPath)
  }
  return actions
}
