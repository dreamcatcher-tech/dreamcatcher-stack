import { shell } from '../../w212-system-covenants'
import { getCovenantState } from '../../w023-system-reducer'
import { Engine, schemaToFunctions } from '../../w210-engine'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { PulseNet } from '../../w208-libp2p'
import { Endurance } from '../../w210-engine/src/Endurance'
import { Crypto } from '../../w210-engine/src/Crypto'

const debug = Debug('interpulse')
/**
 * Hints handles receiving announce calls from the network,
 * and investigates them until it is certain that the engine should be triggerd.
 * The engine might still not execute if a duplicate is detected.
 * Hints is entirely reactive to external events, many of which might be false,
 * intermittent, or grossly delayed.
 *
 * Endurance holds the 'latest' functionality via subscribe() and simply
 * ejects after the first result comes in.
 *
 * In the future, Subscribe may optionally return
 * a confidence rating, of the caller would like to wait around longer.
 * DHT requests may have an emitter on the result, pubsub also may have an emitter.
 * So rather than a callback, you need to consume the results, which also
 * allows an unsubscribe function too.
 *
 * Endurance holds 'self' functionality, where it knows what the address
 * and latest of its own address is.
 */
class Hints {
  static create(engine, net) {
    assert(engine instanceof Engine)
    assert(net instanceof PulseNet)
    const instance = new Hints()
    return instance
  }
  async stop() {
    // TODO unsubscribe from pulsenet
    // stop any sagas to resolve a hint
  }
}

/**
 *
 * The top level ORM object.
 * Assembles an Engine with all the services it needs to operate.
 *    Where IPFS is started.
 *    Where multithreading is controlled.
 * Wraps engine with useful functions for devs.
 * Loads the shell to be loaded at the root block.
 * Works with paths, whereas engine works with addresses.
 * Manages subscriptions to chains for view purposes only.
 */

export class Interpulse {
  #engine
  #endurance
  #hints
  #net
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
    let net, crypto, endurance
    const { repo, CI } = options
    if (repo) {
      // no repo => no net - storage and network are one 🙏
      net = await PulseNet.create(repo, CI)
      crypto = Crypto.create(net.keypair)
      endurance = Endurance.create(net)
    }
    const opts = { ...options, overloads, crypto, endurance }
    const engine = await Engine.create(opts)

    const instance = new Interpulse(engine)
    if (net) {
      instance.#hints = Hints.create(engine, net)
      instance.#net = net
      instance.#endurance = endurance
      instance.#crypto = crypto
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
    const { wd = '/' } = this.#engine.selfLatest.getState().toJS()
    const absolutePath = posix.resolve(wd, path)
    return this.#engine.latestByPath(absolutePath)
  }
  get logger() {
    return this.#engine.logger
  }
  get wd() {
    const { wd = '/' } = this.#engine.latest.getState().toJS()
    return wd
  }
  async stop() {
    await this.#engine.stop() // stop all interpulsing
    if (this.#net) {
      this.#crypto.stop()
      await this.#hints.stop()
      await this.#endurance.stop() // complete all disk writes
      await this.#net.stop()
    }
  }
}
const mapShell = (engine) => {
  const actions = {}
  for (const key of Object.keys(shell.api)) {
    actions[key] = (...args) => {
      const action = shell.api[key](...args)
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
