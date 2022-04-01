import { Hamt } from './Hamt'
import { Channel } from '.'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

class AliasedChannel extends IpldStruct {
  static classMap = {
    channel: Channel,
  }
  static create(channel, alias) {
    assert(channel instanceof Channel, 'Not a Channel')
    assert(typeof alias === 'string', 'Not a string')
    assert(alias, 'Not a string')
    return super.clone({ channel, aliases: [alias] })
  }
}

export class ChannelsHamt extends Hamt {
  static create() {
    return super.create(AliasedChannel)
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
