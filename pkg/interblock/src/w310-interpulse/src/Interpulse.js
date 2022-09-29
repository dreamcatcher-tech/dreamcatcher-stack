import { shell } from '../../w212-system-covenants'
import { getCovenantState } from '../../w023-system-reducer'
import { Engine, schemaToFunctions } from '../../w210-engine'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { PulseNet } from '../../w305-libp2p'
import { NetEndurance } from './NetEndurance'
import { Crypto } from '../../w210-engine/src/Crypto'

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
  #engine
  #endurance
  net
  #crypto
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
    if (net) {
      instance.net = net
      instance.#endurance = endurance
      instance.#crypto = crypto

      // start watching .mtab for remote information
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
    const absolutePath = posix.resolve(wd, path)
    return this.#engine.latestByPath(absolutePath)
  }
  get logger() {
    return this.#engine.logger
  }
  get wd() {
    const { wd = '/' } = this.#engine.selfLatest.getState().toJS()
    return wd
  }
  async stop() {
    await this.#engine.stop() // stop all interpulsing
    if (this.net) {
      this.#crypto.stop()
      await this.#endurance.stop() // complete all disk writes
      await this.net.stop()
    }
  }
  async stats() {
    if (!this.net) {
      return {}
    }
    return await this.net.stats()
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
