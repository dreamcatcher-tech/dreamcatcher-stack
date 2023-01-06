import assert from 'assert-fast'
import Debug from 'debug'
import { Pulse } from '../../w008-ipld'
import Immutable from 'immutable'
const debug = Debug('interblock:api:Crisp')

export class Crisp {
  #parent // the parent Crisp
  // #appRoot // Pulse that is the root of the app
  #pulse // the Pulse that we wrap
  static createRoot(rootPulse) {
    assert(rootPulse instanceof Pulse)
    const result = new Crisp()
    result.#pulse = rootPulse
    return result
  }
  static createChild(pulse, parent) {
    assert(pulse instanceof Pulse)
    assert(parent instanceof Crisp)
    const result = new Crisp()
    result.#pulse = pulse
    result.#parent = parent
    return result
  }
  get root() {
    // walk the parents up until we have root
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
  }
  hasChild(path) {
    assert.strictEqual(typeof path, 'string')
    const network = this.#pulse.getNetwork()

    //if we have this child in whatever is loaded, return true
    // if we are not loaded, return false
    // if we are loaded, but do not have this path, return false

    // this will signal the reconciler to load this path

    // first load the channel into our local cache to get the tip hash
    // then load the pulse into the pulsecache
    // then return true when this is asked for again
  }
  #mapView
  get #map() {
    if (!this.#mapView) {
      const network = this.#pulse.getNetwork()
      this.#mapView = network.channels.list.bakedMap ?? Immutable.Map()
    }
    return this.#mapView
  }
  *[Symbol.iterator]() {
    for (const [key, value] of this.#map.entries()) {
      yield [key, value]
    }
    yield ''
  }
}
