import assert from 'assert-fast'
import Debug from 'debug'
import equals from 'fast-deep-equal'
import { Pulse } from '../../w008-ipld'
// import { Interpulse } from '../../w310-interpulse'
const debug = Debug('interblock:api:Complex')
export default class Complex {
  #parent
  #pulse
  static create({ state, binary, network, actions, isLoading, wd, tree }) {
    return new Complex({ state, binary, network, actions, isLoading, wd, tree })
  }
  static createLoading() {
    return this.create({ isLoading: true })
  }
  async update(pulse, engine) {
    assert(pulse instanceof Pulse)
    // assert(engine instanceof Interpulse)

    // TODO verify this pulse is actually after the current one
    // by default this update is full
    if (this.#pulse && this.#pulse.cid.equals(pulse.cid)) {
      return this
    }
    let prev = this.#pulse
    let next = this.clone()
    next.#pulse = pulse
    if (!prev || !prev.getState().cid.equals(pulse.getState().cid)) {
      debug('state changed')
      const state = pulse.getState().toJS()
      if (!equals(next.state, state)) {
        next = next.setState(state)
      }
    }
    // TODO binary
    if (!prev || !prev.getNetwork().cid.equals(pulse.getNetwork().cid)) {
      debug('network changed')
      const { children } = pulse.getNetwork()
      const { children: previousChildren } = prev ? prev.getNetwork() : {}
      const diff = await children.compare(previousChildren)
      debug(diff)
      // find what channels have changed
      // use sparse array to keep track of channels by id
    }

    return next
  }
  constructor({ state, binary, network, actions, isLoading, wd, tree }) {
    this.state = state || {}
    this.binary = binary
    this.network = network || []
    this.actions = actions || {}
    this.isLoading = isLoading || false
    this.wd = wd || '/'
    this.tree = tree
    if (tree === undefined) {
      this.tree = Complex.create({ ...this, tree: false })
    }
  }
  clone() {
    const next = new Complex(this)
    next.#parent = this.#parent
    next.#pulse = this.#pulse
    return next
  }
  setChild(path, child) {
    assert.strictEqual(typeof path, 'string')
    assert(!path.startsWith('/'))
    assert(!path.startsWith('./'))
    assert(!path.startsWith('..'))
    assert(child instanceof Complex)
    const { tree, ...rest } = child
    console.log('rest', rest)
    const network = [...this.network]
    const index = network.findIndex(({ path: p }) => p === path)
    assert(index !== -1)
    network[index] = { path, ...rest }
    // TODO update the current tree
    return this.setNetwork(network)
  }
  addAction(actions) {
    const next = this.clone()
    next.actions = { ...next.actions, ...actions }
    return next
  }
  setWd(wd) {
    assert.strictEqual(typeof wd, 'string')
    assert(wd.startsWith('/'))
    const next = this.clone()
    next.wd = wd
    return next
  }

  #pathCache = new Map()
  #pathCacheUpTo = 0
  #findChild(path) {
    if (this.#pathCache.has(path)) {
      return this.#pathCache.get(path)
    }
    while (this.#pathCacheUpTo < this.network.length) {
      const child = this.network[this.#pathCacheUpTo++]
      this.#pathCache.set(child.path, child)
      if (child.path === path) {
        return child
      }
    }
  }
  #childCache = new Map()
  child(path) {
    assert.strictEqual(typeof path, 'string', 'path must be a string')
    assert(!path.startsWith('/'))
    assert(!path.startsWith('./'))
    assert(!path.startsWith('..'))
    if (this.#childCache.has(path)) {
      return this.#childCache.get(path)
    }
    const child = this.#findChild(path)
    if (!child) {
      throw new Error(`child not found: ${path}`)
    }
    const { tree } = this
    const next = Complex.create({ ...child, tree })
    if (!tree) {
      next.tree = this
    }
    next.#parent = this
    this.#childCache.set(path, next)
    return next
  }
  hasChild(path) {
    if (path === undefined) {
      return false
    }
    assert.strictEqual(typeof path, 'string')
    assert(!path.startsWith('/'))
    assert(!path.startsWith('./'))
    assert(!path.startsWith('..'))
    return !!this.#findChild(path)
  }
  rm(path) {
    assert(this.hasChild(path))
    const next = this.clone()
    next.network = next.network.filter(({ path: p }) => p !== path)
    return next
  }
  setNetwork(network) {
    assert(Array.isArray(network))
    const next = this.clone()
    next.network = network
    return next
  }
  setState(state) {
    assert.strictEqual(typeof state, 'object')
    const next = this.clone()
    next.state = state
    return next
  }
  setIsLoading(isLoading) {
    assert.strictEqual(typeof isLoading, 'boolean')
    const next = this.clone()
    next.isLoading = isLoading
    return next
  }
  parent() {
    return this.#parent
  }
}
