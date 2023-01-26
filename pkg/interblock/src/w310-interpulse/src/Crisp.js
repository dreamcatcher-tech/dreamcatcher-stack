import { schemaToFunctions } from '../../w002-api'
import assert from 'assert-fast'
import Debug from 'debug'
import { Channel, Pulse } from '../../w008-ipld'
import Immutable from 'immutable'
import posix from 'path-browserify'
const debug = Debug('interblock:api:Crisp')

export class Crisp {
  #parent // the parent Crisp
  #name // the name of this Crisp, passed down from the parent
  #pulse // the Pulse that this Crisp is wrapping
  #rootActions // the actions of the engine
  #chroot // the chroot of the Syncer that made this Crisps root
  #wd = '/' // the working directory which is only set in the root
  #snapshotChannelMap // a snapshot of the channels map
  #snapshotAliasMap // a snapshot of the aliases map
  #isCovenantSnapshot = false // if true, the covenant has been snapshotted

  static createLoading() {
    const result = new Crisp()
    return result
  }
  static createRoot(rootPulse, rootActions, chroot = '/') {
    assert(rootPulse instanceof Pulse)
    assert.strictEqual(typeof rootActions, 'object')
    assert.strictEqual(typeof rootActions.dispatch, 'function')
    assert.strictEqual(typeof chroot, 'string')
    assert(chroot.startsWith('/'))
    const result = new Crisp()
    result.#pulse = rootPulse
    result.#rootActions = rootActions
    result.#chroot = chroot
    return result
  }
  static createChild(pulse, parent, name) {
    assert(!pulse || pulse instanceof Pulse)
    assert(parent instanceof Crisp)
    assert.strictEqual(typeof name, 'string')
    assert(name)
    const result = new Crisp()
    result.#pulse = pulse
    result.#parent = parent
    result.#name = name
    return result
  }
  get isLoading() {
    // this call signals the reconciler that loading is required
    return !this.#pulse
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
  get isLoadingActions() {
    // this call signals the reconciler that loading is required
    this.#snapshotCovenant()
    return this.isLoading || !this.#pulse.provenance.dmz.bakedCovenant
  }
  hasAction(name) {
    assert.strictEqual(typeof name, 'string')
    assert(name)
    assert(!name.includes('/'))
    debug('hasAction', name)
    if (this.isLoadingActions) {
      throw new Error('cannot get actions from a loading Crisp')
    }
    assert(this.#isCovenantSnapshot)
    const covenant = this.#pulse.provenance.dmz.bakedCovenant
    const state = covenant.getState().toJS()
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
    return posix.normalize(this.chroot + '/' + this.path)
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
    const covenant = this.#pulse.provenance.dmz.bakedCovenant
    const state = covenant.getState().toJS()
    const { api = {} } = state
    const actions = schemaToFunctions(api)
    const dispatches = {}
    for (const key of Object.keys(actions)) {
      dispatches[key] = (payload) => {
        const action = actions[key](payload)
        const to = posix.normalize(this.chroot + '/' + this.path)
        return this.root.#rootActions.dispatch(action, to)
      }
      Object.assign(dispatches[key], actions[key])
    }
    return dispatches
  }
  #snapshotCovenant() {
    if (this.#isCovenantSnapshot) {
      return
    }
    this.#isCovenantSnapshot = true
  }
  get parent() {
    return this.#parent
  }
  get state() {
    if (this.isLoading) {
      return {}
    }
    return this.#pulse.getState().toJS()
  }
  getChild(path) {
    assert.strictEqual(typeof path, 'string')
    if (!this.hasChild(path)) {
      throw new Error(`child not found: ${path}`)
    }
    const channelId = this.#aliasMap.get(path)
    const channel = this.#channelMap.get(channelId)
    assert(channel instanceof Channel)
    const childPulse = channel.rx.latest?.bakedPulse
    const child = Crisp.createChild(childPulse, this, path)
    return child
  }
  hasChild(path) {
    assert.strictEqual(typeof path, 'string')
    this.#snapshotMaps()
    return this.#aliasMap.has(path)
  }
  #snapshotMaps() {
    if (this.isLoading) {
      throw new Error('cannot get map from a loading Crisp')
    }
    const isBoth = this.#snapshotChannelMap && this.#snapshotAliasMap
    const isNeither = !this.#snapshotChannelMap && !this.#snapshotAliasMap
    assert(!(isBoth && isNeither), 'either both or neither should be set')
    if (isBoth) {
      return
    }
    const network = this.#pulse.getNetwork()
    this.#snapshotChannelMap = network.channels.list.bakedMap ?? Immutable.Map()
    this.#snapshotAliasMap = network.children.bakedMap ?? Immutable.Map()
  }
  get #channelMap() {
    this.#snapshotMaps()
    return this.#snapshotChannelMap
  }
  get #aliasMap() {
    this.#snapshotMaps()
    return this.#snapshotAliasMap
  }
  *[Symbol.iterator]() {
    for (const [, value] of this.#channelMap.entries()) {
      const { aliases = [] } = value
      // TODO shortcut until aliases are remodeled
      const [alias] = aliases
      if (alias && !alias.startsWith('.')) {
        yield alias
      }
    }
  }
  get sortedChildren() {
    const children = [...this]
    children.sort((a, b) => {
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
    return children
  }
  get covenant() {
    if (this.isLoading) {
      throw new Error('cannot get covenant from a loading Crisp')
    }
    return this.#pulse.getCovenantPath()
  }
  #clone() {
    const next = new Crisp()
    next.#parent = this.#parent
    next.#name = this.#name
    next.#pulse = this.#pulse
    next.#rootActions = this.#rootActions
    next.#chroot = this.#chroot
    next.#wd = this.#wd
    next.#snapshotChannelMap = this.#snapshotChannelMap
    next.#snapshotAliasMap = this.#snapshotAliasMap
    next.#isCovenantSnapshot = this.#isCovenantSnapshot
    return next
  }
  setWd(path) {
    assert.strictEqual(typeof path, 'string')
    assert(this.isRoot, 'wd can only be set on the root')
    const next = this.#clone()
    next.#wd = path
    return next
  }
  get wd() {
    return this.root.#wd
  }
}
