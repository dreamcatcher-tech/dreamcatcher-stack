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
  static async uncrush(cid, resolver) {
    return await super.uncrush(cid, resolver, Channel, isMutable)
  }
  async compare(other) {
    const diff = await super.compare(other)
    const added = new Set([...diff.added].map((key) => parseInt(key)))
    const deleted = new Set([...diff.deleted].map((key) => parseInt(key)))
    const modified = new Set([...diff.modified].map((key) => parseInt(key)))
    return { added, deleted, modified }
  }
  async *entries() {
    const entries = super.entries()
    try {
      for await (const [key] of entries) {
        const channelId = parseInt(key)
        const value = await this.get(channelId)
        yield [parseInt(key), value]
      }
    } finally {
      entries.return()
    }
  }
}
