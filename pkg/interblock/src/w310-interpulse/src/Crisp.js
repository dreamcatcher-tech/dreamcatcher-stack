import { schemaToFunctions } from '../../w002-api'
import assert from 'assert-fast'
import Debug from 'debug'
import { Pulse, Address } from '../../w008-ipld'
import posix from 'path-browserify'
import { BakeCache } from './BakeCache'
const debug = Debug('interblock:api:Crisp')

export class Crisp {
  #parent // the parent Crisp
  #name // the name of this Crisp, passed down from the parent
  #address // the address backing this Crisp
  #rootActions // the base actions of the engine
  #chroot // the chroot of the Syncer that made this Crisps root
  #wd = '/' // the working directory which is only set in the root Crisp
  #cache
  #isDeepLoaded = false // if true, the pulse tree is now fully baked

  // snapshot tracking
  #isPulseAndChannelsSnapshotted = false
  #pulseSnapshot
  #channelsSnapshot
  #isCovenantSnapshotted = false
  #covenantSnapshot

  #cachedAliases

  #clone() {
    const next = new Crisp()
    next.#parent = this.#parent
    next.#name = this.#name
    next.#address = this.#address
    next.#rootActions = this.#rootActions
    next.#chroot = this.#chroot
    next.#wd = this.#wd
    next.#cache = this.#cache
    next.#isDeepLoaded = this.#isDeepLoaded
    next.#isPulseAndChannelsSnapshotted = this.#isPulseAndChannelsSnapshotted
    next.#pulseSnapshot = this.#pulseSnapshot
    next.#channelsSnapshot = this.#channelsSnapshot
    next.#isCovenantSnapshotted = this.#isCovenantSnapshotted
    next.#covenantSnapshot = this.#covenantSnapshot
    next.#cachedAliases = this.#cachedAliases
    return next
  }
  static createLoading(chroot = '/') {
    const address = Address.createRoot()
    const actions = {
      dispatch: () => {
        throw new Error('cannot dispatch from loading Crisp')
      },
    }
    return Crisp.createRoot(address, actions, chroot)
  }
  static createRoot(root, actions, chroot = '/', cache) {
    assert(root instanceof Address)
    assert.strictEqual(typeof actions, 'object')
    assert.strictEqual(typeof actions.dispatch, 'function')
    assert(posix.isAbsolute(chroot), `chroot not absolute: ${chroot}`)
    cache = cache || BakeCache.createCI()
    assert(cache instanceof BakeCache)
    const result = new Crisp()
    result.#address = root
    result.#rootActions = actions
    result.#chroot = chroot
    result.#cache = cache
    return result
  }
  static #createChild(address, parent, name) {
    assert(address instanceof Address)
    assert(parent instanceof Crisp)
    assert.strictEqual(typeof name, 'string')
    assert(name)
    assert(!posix.isAbsolute(name), `name must be relative: ${name}`)
    const result = new Crisp()
    result.#address = address
    result.#parent = parent
    result.#name = name
    return result
  }
  get isLoading() {
    // this call should signal the reconciler that loading is required
    this.#snapshotPulse()
    return !this.#pulseSnapshot
  }
  get isRoot() {
    return !this.#parent
  }
  get root() {
    if (!this.#parent) {
      return this
    }
    return this.#parent.root
  }
  get chroot() {
    return this.root.#chroot
  }
  #snapshotCovenant() {
    if (this.#isCovenantSnapshotted) {
      return
    }
    this.#isCovenantSnapshotted = true
    if (this.isLoading) {
      return
    }
    const path = this.#pulseSnapshot.getCovenantPath()
    if (this.root.#cache.hasCovenant(path)) {
      this.#covenantSnapshot = this.root.#cache.getCovenant(path)
    }
  }
  get isLoadingActions() {
    // this call signals the reconciler that loading is required
    this.#snapshotCovenant()
    return !this.#covenantSnapshot
  }
  hasAction(name) {
    assert.strictEqual(typeof name, 'string')
    assert(name)
    assert(!name.includes('/'))
    debug('hasAction', name)
    if (this.isLoadingActions) {
      throw new Error('cannot get actions from a loading Crisp')
    }
    const state = this.#covenantSnapshot.getState().toJS()
    const { api = {} } = state
    return !!api[name]
  }
  get path() {
    if (this.isRoot) {
      return '/'
    }
    if (this.#parent.isRoot) {
      return '/' + this.#name
    }
    return this.#parent.path + '/' + this.#name
  }
  get absolutePath() {
    if (this.isRoot) {
      return this.chroot
    }
    return this.chroot + this.path
  }
  get actions() {
    if (this.isRoot) {
      if (this.chroot === '/') {
        return this.ownActions
      } else {
        return Object.assign({}, this.#rootActions, this.ownActions)
      }
    }
    return Object.assign({}, this.#parent.actions, this.ownActions)
  }
  get ownActions() {
    if (this.isLoadingActions) {
      throw new Error('cannot get actions from a loading Crisp')
    }
    if (this.isRoot && this.chroot === '/') {
      return this.#rootActions
    }
    const state = this.#covenantSnapshot.getState().toJS()
    const { api = {} } = state
    const actions = schemaToFunctions(api)
    const dispatches = {}
    for (const key of Object.keys(actions)) {
      dispatches[key] = (...args) => {
        const action = actions[key](...args)
        const path = this.path === '/' ? '' : '/' + this.path
        const to = posix.normalize(this.chroot + path)
        return this.root.#rootActions.dispatch(action, to)
      }
      Object.assign(dispatches[key], actions[key])
    }
    return dispatches
  }

  get parent() {
    return this.#parent
  }
  #snapshotPulse() {
    if (this.#isPulseAndChannelsSnapshotted) {
      return
    }
    this.#isPulseAndChannelsSnapshotted = true
    if (this.root.#cache.hasPulse(this.#address)) {
      this.#pulseSnapshot = this.root.#cache.getPulse(this.#address)
      if (this.root.#cache.hasChannels(this.#address)) {
        this.#channelsSnapshot = this.root.#cache.getChannels(this.#address)
      }
    }
  }
  get state() {
    if (this.isLoading) {
      return {}
    }
    return this.#pulseSnapshot.getState().toJS()
  }
  get isLoadingChildren() {
    if (this.isLoading) {
      return true
    }
    return !this.#channelsSnapshot
  }
  hasChild(path) {
    assert.strictEqual(typeof path, 'string')
    if (this.isLoadingChildren) {
      throw new Error(`cannot get children from a loading Crisp: ${this.path}`)
    }
    this.#cacheAliases()
    return this.#cachedAliases.has(path)
  }
  getChild(path) {
    assert.strictEqual(typeof path, 'string')
    this.#cacheAliases()
    if (!this.hasChild(path)) {
      throw new Error(`child not found: ${path}`)
    }
    const address = this.#cachedAliases.get(path)
    const child = Crisp.#createChild(address, this, path)
    return child
  }
  #cacheAliases() {
    if (this.#cachedAliases) {
      return
    }
    this.#snapshotPulse()
    if (!weakCache.has(this.#channelsSnapshot)) {
      const map = new Map()
      for (const channel of this.#channelsSnapshot.values()) {
        if (!channel.aliases) {
          continue
        }
        const [alias = ''] = channel.aliases
        assert.strictEqual(typeof alias, 'string', `invalid alias: ${alias}`)
        if (alias && alias !== '.' && alias !== '..') {
          assert(!map.has(alias), `duplicate alias: ${alias}`)
          const address = Address.fromCID(channel.address)
          map.set(alias, address)
        }
      }
      weakCache.set(this.#channelsSnapshot, { map })
    }
    this.#cachedAliases = weakCache.get(this.#channelsSnapshot).map
  }
  [Symbol.iterator]() {
    if (this.isLoadingChildren) {
      throw new Error(`cannot get children from a loading Crisp: ${this.path}`)
    }
    this.#cacheAliases()
    return this.#cachedAliases.keys()
  }
  get sortedChildren() {
    this.#cacheAliases()
    const cache = weakCache.get(this.#channelsSnapshot)
    if (!cache.sorted) {
      cache.sorted = [...this]
      cache.sorted.sort((a, b) => {
        const ai = Number.parseInt(a)
        const bi = Number.parseInt(b)
        if (Number.isNaN(ai) && Number.isNaN(bi)) {
          return a.localeCompare(b)
        }
        if (Number.isNaN(ai)) {
          return -1
        }
        if (Number.isNaN(bi)) {
          return 1
        }
        return ai - bi
      })
    }
    return cache.sorted
  }
  get covenantPath() {
    return this.pulse.getCovenantPath()
  }
  setWd(path) {
    assert.strictEqual(typeof path, 'string')
    assert(this.isRoot, 'wd can only be set on the root')
    assert(posix.isAbsolute(path), 'wd must be absolute')
    const next = this.#clone()
    next.#wd = path
    return next
  }
  get wd() {
    return this.root.#wd
  }
  getSelectedChild() {
    if (this.wd.startsWith(this.path)) {
      const length = this.isRoot ? 0 : this.path.length
      const tail = this.wd.slice(length + '/'.length)
      const [child] = tail.split('/')
      debug('tail %s selectedChild %s', tail, child)
      if (child) {
        return child
      }
    }
  }
  set isDeepLoaded(value) {
    assert(this.isRoot, 'isDeepLoaded can only be set on the root')
    assert.strictEqual(typeof value, 'boolean')
    this.#isDeepLoaded = value
  }
  get isDeepLoaded() {
    return this.root.#isDeepLoaded
  }
  get pulse() {
    if (this.isLoading) {
      throw new Error('cannot get pulse from a loading Crisp')
    }
    assert(this.#pulseSnapshot instanceof Pulse)
    return this.#pulseSnapshot
  }
  isStale() {
    // TODO compare the pulse and pulseId in the cache
  }
  isPathStale() {
    // TODO walk up to root and check if anything is stale
    // if so, means that we *might* be stale
  }
}
const weakCache = new WeakMap() // channelsSnapshot -> aliasMap
