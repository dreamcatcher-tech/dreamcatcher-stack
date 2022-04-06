import { Hamt } from './Hamt'
import { Channel } from '.'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

/**
type Channels struct {
    counter Int
    channelSet HashMapRoot           # Map of channelIds to Channels
    addresses HashMapRoot          # reverse lookup of channels
}
 */
export class Channels extends IpldStruct {
  static classMap = {
    channelSet: Hamt,
    addresses: Hamt,
  }
  static create() {
    const isMutable = true
    const channelSet = Hamt.create(Channel, isMutable)
    const addresses = Hamt.create()
    return super.clone({ counter: 0, channelSet, addresses })
  }
  async delete(channelId) {
    await this.assertChannelIdValid(channelId)
    const channelSet = this.channelSet.delete(channelId)
    return this.constructor.clone({ ...this, channelSet })
  }
  async getChannel(channelId) {
    await this.assertChannelIdValid(channelId)
    return await this.channelSet.get(channelId)
  }
  async assertChannelIdValid(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channelId < this.counter)
    assert(await this.channelSet.has(channelId), `channelId not present`)
  }
  async createChannel(channel) {
    assert(channel instanceof Channel)
    assert(Number.isInteger(this.counter))
    assert(this.counter >= 0)
    let { counter, addresses } = this
    const channelId = counter++
    const channelSet = this.channelSet.set(channelId, channel)
    if (channel.isRemote()) {
      const address = channel.getAddress().toString()
      assert(!(await this.addresses.has(address)))
      addresses = this.addresses.set(address, channelId)
    }
    return this.setMap({ counter, channelSet, addresses })
  }
  async updateChannel(channelId, channel) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channelId < this.counter)
    assert(channel instanceof Channel)
    assert(await this.channelSet.has(channelId), `channelId not present`)

    const previous = await this.channelSet.get(channelId)
    assert(previous.isNext(channel))
    const channelSet = this.channelSet.set(channelId, channel)
    let { addresses } = this
    if (!previous.isRemote() && channel.isRemote()) {
      const address = channel.getAddress().toString()
      assert(!(await this.addresses.has(address)))
      addresses = addresses.set(address, channelId)
    }
    return this.setMap({ channelSet, addresses })
  }
}
