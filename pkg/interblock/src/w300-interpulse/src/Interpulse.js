import { shell } from '../../w212-system-covenants'
import { Engine, schemaToFunctions } from '../../w210-engine'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
const debug = Debug('interpulse')
/**
 * Where the shell is loaded and attached.
 * Where IPFS is started.
 * Where multithreading is controlled.
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
