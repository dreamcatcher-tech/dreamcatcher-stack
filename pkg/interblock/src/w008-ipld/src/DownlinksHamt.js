import { Hamt } from './Hamt'
import { Channel } from '.'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
/**
 * Children are always fully resolved.
 * When crush occurs, should check the channels are next.
 * Alias cannot have '/' character in it.
 * Channels have to have an address on them.
 */
export class DownlinksHamt extends Hamt {
  static create() {
    return super.create()
  }
  get isBakeSkippable() {
    return true
  }
  set() {
    throw new Error('not implemented')
  }
  setDownlink(name, channelId) {
    assert.strictEqual(typeof name, 'string')
    assert(name)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    return super.set(name, channelId)
  }
  delete(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.counter)
  }
}
