import { Hamt } from './Hamt'
import { Channel } from '.'
import assert from 'assert-fast'
const isMutable = true
export class ChannelsHamt extends Hamt {
  static create() {
    return super.create(Channel, isMutable)
  }
  async set(channelId, channel) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channel instanceof Channel)
    return await super.set(channelId, channel)
  }
  async has(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    return await super.has(channelId)
  }
  async delete(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    throw new Error('not implemented')
  }
  async get(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    return await super.get(channelId)
  }
  async uncrush(cid, resolver, options) {
    return await super.uncrush(cid, resolver, Channel, isMutable)
  }
}
