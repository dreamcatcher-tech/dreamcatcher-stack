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
export class ChildrenHamt extends Hamt {
  set() {
    throw new Error('not implemented')
  }
  async addChild(path, channelId) {
    // TODO check that a child does not already exist with this address
    assert(typeof path === 'string')
    assert(path)
    assert(!path.includes('/'))
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    return await super.set(path, channelId)
  }
}
