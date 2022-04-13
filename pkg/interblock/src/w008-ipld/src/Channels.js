import { Hamt } from './Hamt'
import { Channel, Address, Interpulse } from '.'
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
    const rxs = []
    const txs = []
    return super.clone({ counter: 0, list, addresses, rxs, txs })
  }
  async hasAddress(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    return await this.addresses.has(address.cid.toString())
  }
  async getByAddress(address) {
    assert(address instanceof Address)
    const channelId = await this.addresses.get(address.cid.toString())
    return await this.list.get(channelId)
  }
  async deleteChannel(channelId) {
    await this.assertChannelIdValid(channelId)
    const list = this.list.delete(channelId)
    return this.setMap({ list })
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
  async addChannel(channel) {
    assert(channel instanceof Channel)
    assert(Number.isInteger(this.counter))
    assert(this.counter >= 0)
    let { counter, addresses } = this
    const channelId = counter++
    const list = await this.list.set(channelId, channel)
    if (channel.isRemote()) {
      const key = channel.getAddress().cid.toString()
      assert(!(await this.addresses.has(key)))
      addresses = await this.addresses.set(key, channelId)
    }
    const next = this.setMap({ counter, list, addresses })
    return next.updateActives(channelId, channel)
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
      const key = channel.getAddress().cid.toString()
      assert(!(await this.addresses.has(key)))
      addresses = addresses.set(key, channelId)
    }
    const next = this.setMap({ list, addresses })
    return next.updateActives(channelId, channel, previous)
  }
  updateActives(channelId, channel) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channel instanceof Channel)
    let { rxs, txs } = this
    if (!channel.rx.isEmpty()) {
      if (!rxs.includes(channelId)) {
        rxs = [...rxs, channelId]
      }
    }
    if (!channel.tx.isEmpty()) {
      if (!txs.includes(channelId)) {
        txs = [...txs, channelId]
      }
    }
    return this.setMap({ rxs, txs })
  }
  async getTx(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(this.txs.includes(channelId))
    const { tx } = await this.list.get(channelId)
    assert(!tx.isEmpty())
    return tx
  }
  blankTxs() {
    return this.delete('txs')
  }
  async ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { source } = interpulse
    const channelId = await this.addresses.get(source)
    let channel = await this.getByAddress(source)
    channel = channel.ingestInterpulse(interpulse)
    return this.updateChannel(channelId, channel)
  }
}
