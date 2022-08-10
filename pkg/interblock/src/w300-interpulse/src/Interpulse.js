import { shell } from '../../w212-system-covenants'
// import { createRepo } from 'ipfs-repo'
import { getCovenantState } from '../../w023-system-reducer'
import { Engine, schemaToFunctions } from '../../w210-engine'
import assert from 'assert-fast'
import Debug from 'debug'
import posix from 'path-browserify'
import { loadCodec } from '../../w210-engine/test/fixtures/loadCodec'
import { createRepo } from 'ipfs-core-config/repo'

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
  static async createCI(options = {}) {
    options = { ...options }
    if (options.repo && typeof options.repo === 'string') {
      options.repo = createRepo(debug, loadCodec, { path: options.repo })
    }
    options.overloads = { ...options.overloads, root: shell }
    const engine = await Engine.createCI(options)
    const instance = new Interpulse(engine)
    return instance
  }
  static async create(options) {
    options = { ...options }
    options.overloads = { ...options.overloads, root: shell }
    const engine = await Engine.create(options)
    const instance = new Interpulse(engine)
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
    const { wd = '/' } = this.#engine.latest.getState().toJS()
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
  async shutdown() {
    await this.#engine.ipfsStop()
  }
  async ipfsStart() {
    debug(`starting ipfs...`)
    await this.#engine.ipfsStart()
    debug(`ipfs started`)
  }
  get ipfs() {
    return this.#engine.ipfs
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
