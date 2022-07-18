import { shell } from '../../w212-system-covenants'
import { Engine, schemaToFunctions } from '../../w210-engine'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
const debug = Debug('interpulse')
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
  static async createCI() {
    const engine = await Engine.createCI()
    const instance = new Interpulse(engine)
    return instance
  }
  static async create() {
    const engine = await Engine.create()
    const instance = new Interpulse(engine)
    return instance
  }
  constructor(engine) {
    assert(engine instanceof Engine)
    const overloads = { root: shell }
    engine.overload(overloads)
    const actions = mapShell(engine)
    Object.assign(this, actions)
    this.#engine = engine
  }
  async actions(path = '.') {
    const state = await this.covenant(path)
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
    const { wd = '/' } = this.#engine.latest.getState().toJS()
    const absolutePath = posix.resolve(wd, path)
    return this.#engine.latestByPath(absolutePath)
  }
  get logger() {
    return this.#engine.logger
  }
  shutdown() {
    // stop the ipfs agent from running
    // persist our config down to ipfs storage
    // shutdown multithreading
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
  return actions
}
