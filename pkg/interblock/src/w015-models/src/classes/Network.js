import assert from 'assert-fast'
import Immutable from 'immutable'
import { channelModel, addressModel } from '../..'
class Model {
  #supersecret = 'supersecret'
}

// TODO merge this with Conflux ?
export class Network extends Model {
  #channels = [] // stored on disk {alias,channel}
  #merkleTree = [] // kept to minimize hash cost
  #channelMap = Immutable.Map() // channel to channel index
  #aliasMap = Immutable.Map() // alias -> channel index
  #diffAdd = Immutable.Map() // channel index -> channel
  #diffDel = Immutable.Map() // channel index deletions
  #txs = Immutable.Map() // any channel that is transmitting
  constructor(channels) {
    super()
    if (channels) {
      // inflate everything
      // assume this is pure JS
      // check for collisions and sanity
    }
  }
  #clone() {
    const network = new Network()
    network.#channels = this.#channels
    // etc...
    return network
  }
  equals(other) {
    throw new Error('not implemented')
  }
  set(alias, channel) {
    assert.strictEqual(typeof alias, 'string')
    assert(channelModel.isModel(channel))
    assert(alias !== '.')
    assert(alias !== '..')
    assert(!this.#aliasMap.has(alias) || this.#diffDel.has(alias))

    // keep tx tracker in sync after compaction has occured
    // pull out tx before compaction occurs

    const next = this.#clone()
    if (next.#diffDel.has(alias)) {
      next.#diffDel = next.#diffDel.delete(alias)
      if (!channel.equals(next.#aliasMap.get(alias))) {
        next.#diffAdd = next.#diffAdd.set(alias, channel)
      }
    }
    return next
  }
  del(alias) {
    assert.strictEqual(typeof alias, 'string')
    assert(alias !== '.')
    assert(alias !== '..')

    if (this.#diffAdd.has(alias)) {
      const next = this.#clone()
      next.#diffAdd = next.#diffAdd.delete(alias)
      return next
    }
    const next = this.#clone()
    next.#diffDel = this.#diffDel.set(alias)
    return next
  }
  rename(srcAlias, destAlias) {
    // needed to preserve the hash tree efficiently
    assert.strictEqual(typeof srcAlias, 'string')
    assert.strictEqual(typeof destAlias, 'string')
    assert(srcAlias !== destAlias)
    assert(this.get(srcAlias))
    assert(!this.get(destAlias))

    const src = this.get(srcAlias)
    let next = this.add(destAlias, src).del(srcAlias)
    return next
  }
  get(alias) {
    assert.strictEqual(typeof alias, 'string')
    if (this.#diffAdd.has(alias)) {
      return this.#diffAdd.get(alias)
    }
    if (this.#diffDel.has(alias)) {
      return
    }
    return this.#aliasMap.get(alias)
  }
  getByAddress(address) {
    assert(addressModel.isModel(address))
    // if the lookup table doesn't have it, and the lookup table
    // hasn't finished, then keep building the lookup table until
    // and return the result
  }
  getHash() {
    // calculate the hash
    // diff must have been squashed first
    // all transmissions must have been drained
    // compress the channels array
  }
  squash() {
    // compact the channels array so all deletions are filled by adds
    // merge the diffs into the main map and return a new instance
  }
  diff() {
    // create a patch list that can be applied to #channels
  }
  patch(opsList) {
    // take a list of operations, and apply them to this object
  }
  serialize() {
    return JSON.stringify(this.#channels)
  }
  getTxs() {
    // returns list of channel indexes that are transmitting
  }
}
