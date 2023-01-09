import assert from 'assert-fast'
import Debug from 'debug'
import { Channel, Pulse } from '../../w008-ipld'
import Immutable from 'immutable'
const debug = Debug('interblock:api:Crisp')

export class Crisp {
  #parent // the parent Crisp
  #pulse // the Pulse that this Crisp is wrapping
  #wd = '/' // the working directory which is only set in the root
  #snapshotChannelMap // a snapshot of the channels map
  #snapshotAliasMap // a snapshot of the aliases map
  static createLoading() {
    const result = new Crisp()
    return result
  }
  static createRoot(rootPulse) {
    assert(rootPulse instanceof Pulse)
    const result = new Crisp()
    result.#pulse = rootPulse
    return result
  }
  static createChild(pulse, parent) {
    assert(!pulse || pulse instanceof Pulse)
    assert(parent instanceof Crisp)
    const result = new Crisp()
    result.#pulse = pulse
    result.#parent = parent
    return result
  }
  get isLoading() {
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
  get isActionsLoaded() {
    // returns true if the actions are fully loaded
    // this call signals the reconciler that loading is required
    return false
  }
  get parent() {
    return this.#parent
  }
  get state() {
    const state = this.#pulse.getState().toJS()
    return state
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
    const child = Crisp.createChild(childPulse, this)
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
      const { aliases } = value
      // TODO shortcut until aliases are remodeled
      yield aliases[0]
    }
  }
  #clone() {
    const next = new Crisp()
    next.#parent = this.#parent
    next.#pulse = this.#pulse
    next.#wd = this.#wd
    next.#snapshotChannelMap = this.#snapshotChannelMap
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
  toJS() {
    // walk the crisp and return a single large JS object as a snapshot
  }
  fromJS(js) {
    // make a Crisp from a JS object instead of a pulse.
    // may be useful for mocking purposes
  }
}
