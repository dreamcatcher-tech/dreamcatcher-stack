import { Hamt } from './Hamt'
import { Channel } from '.'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

/**
type Channels struct {
    counter Int
    list HashMapRoot           # Map of channelIds to Channels
    addresses HashMapRoot          # reverse lookup of channels
}
 */
export class Channels extends IpldStruct {
  static classMap = {
    list: Hamt,
    addresses: Hamt,
  }
  static create() {
    const isMutable = true
    const list = Hamt.create(Channel, isMutable)
    const addresses = Hamt.create()
    return super.clone({ counter: 0, list, addresses })
  }
  async delete(channelId) {
    await this.assertChannelIdValid(channelId)
    const list = this.list.delete(channelId)
    return this.constructor.clone({ ...this, list })
  }
  async getChannel(channelId) {
    await this.assertChannelIdValid(channelId)
    return await this.list.get(channelId)
  }
  async assertChannelIdValid(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channelId < this.counter)
    assert(await this.list.has(channelId), `channelId not present`)
  }
  async createChannel(channel) {
    assert(channel instanceof Channel)
    assert(Number.isInteger(this.counter))
    assert(this.counter >= 0)
    let { counter, addresses } = this
    const channelId = counter++
    const list = this.list.set(channelId, channel)
    if (channel.isRemote()) {
      const address = channel.getAddress().toString()
      assert(!(await this.addresses.has(address)))
      addresses = this.addresses.set(address, channelId)
    }
    return this.setMap({ counter, list, addresses })
  }
  async updateChannel(channelId, channel) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channelId < this.counter)
    assert(channel instanceof Channel)
    assert(await this.list.has(channelId), `channelId not present`)

    const previous = await this.list.get(channelId)
    assert(previous.isNext(channel))
    const list = this.list.set(channelId, channel)
    let { addresses } = this
    if (!previous.isRemote() && channel.isRemote()) {
      const address = channel.getAddress().toString()
      assert(!(await this.addresses.has(address)))
      addresses = addresses.set(address, channelId)
    }
    return this.setMap({ list, addresses })
  }
}
