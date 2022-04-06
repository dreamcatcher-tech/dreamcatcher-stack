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
export class UplinksHamt extends Hamt {
  static create() {
    return super.create(Channel)
  }
  set() {
    throw new Error('not implemented')
  }
  delete(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.counter)
  }
  async updateChannel(channelId, channel) {
    // assumes this channel is present already
    assert()
  }
  setChannel(channelId, channel) {
    // when go to crush, ensure we are not reinstating something that has been deleted
  }
}
