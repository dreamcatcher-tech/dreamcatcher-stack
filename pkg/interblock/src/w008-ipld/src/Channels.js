import {
  ChannelsHamt,
  AddressesHamt,
  PulseLink,
  Channel,
  Address,
  Interpulse,
} from '.'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

/**
type Channels struct {
    counter Int
    list HashMapRoot               # Map of channelIds to Channels
    addresses HashMapRoot          # reverse lookup of channels
    rxs [ Int ]
    txs [ Int ]
}



 */
const FIXED_CHANNEL_COUNT = 3

export class Channels extends IpldStruct {
  static classMap = {
    list: ChannelsHamt,
    addresses: AddressesHamt,
  }
  static create() {
    const list = ChannelsHamt.create()
    const counter = FIXED_CHANNEL_COUNT
    const addresses = AddressesHamt.create()
    const rxs = []
    const txs = []
    return super.clone({ counter, list, addresses, rxs, txs })
  }
  assertLogic() {}
  async has(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channelId < this.counter)
    return await this.list.has(channelId)
  }
  async hasAddress(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    return await this.addresses.has(address)
  }
  async getByAddress(address) {
    assert(address instanceof Address)
    const channelId = await this.addresses.get(address)
    return await this.getChannel(channelId)
  }
  async deleteChannel(channel) {
    const { channelId } = channel
    await this.#assertChannelIdValid(channelId)
    const list = await this.list.delete(channelId)
    const next = this.setMap({ list })
    // TODO may send a signal to the child
    // TODO reject all actions and promises
    // TODO may only allow this on a channel that is invalidated
    channel = channel.setMap({ address: Address.createDeleted() })
    return next.#updateActives(channel)
  }
  async getChannel(channelId) {
    await this.#assertChannelIdValid(channelId)
    const channel = await this.list.get(channelId)
    assert.strictEqual(channelId, channel.channelId)
    return channel
  }
  async #assertChannelIdValid(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(channelId < this.counter)
    if (channelId >= FIXED_CHANNEL_COUNT) {
      assert(await this.list.has(channelId), `channelId not present`)
    }
  }
  async addChannel(channel) {
    assert(channel instanceof Channel)
    assert(Number.isInteger(this.counter))
    assert(this.counter >= FIXED_CHANNEL_COUNT)
    let { counter, addresses } = this
    const channelId = counter++
    assert.strictEqual(channelId, channel.channelId)
    const list = await this.list.set(channelId, channel)
    const { address } = channel
    if (address.isRemote()) {
      addresses = await this.addresses.set(address, channelId)
    }
    const next = this.setMap({ counter, list, addresses })
    return next.#updateActives(channel)
  }
  async updateChannel(channel) {
    const { channelId } = channel
    await this.#assertChannelIdValid(channelId)
    let previous
    const isPrevious = await this.list.has(channelId)
    if (channelId >= FIXED_CHANNEL_COUNT || isPrevious) {
      previous = await this.list.get(channelId)
      assert(previous.isNext(channel))
      // TODO if channel is identical, return
    }
    const list = await this.list.set(channelId, channel)

    let { addresses } = this
    if (channel.isRemote()) {
      // TODO is it even possible that a channel address changes ?
      // perhaps it should be fixed, and a recreation is required ?
      if (!previous || !channel.address.equals(previous.address)) {
        if (previous && previous.address.isRemote()) {
          if (await addresses.has(previous.address)) {
            addresses = await addresses.delete(previous.address)
          }
        }
        addresses = await addresses.set(channel.address, channelId)
      }
    }
    const next = this.setMap({ list, addresses })
    return next.#updateActives(channel, previous)
  }
  #updateActives(channel, previous) {
    assert(channel instanceof Channel)
    assert(!previous || previous instanceof Channel)
    const { channelId } = channel
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    const { address } = channel
    let { rxs, txs } = this
    if (address.isDeleted()) {
      if (rxs.includes(channelId)) {
        rxs = rxs.filter((id) => id !== channelId)
      }
      if (txs.includes(channelId)) {
        txs = txs.filter((id) => id !== channelId)
      }
      const next = this.setMap({ rxs, txs })
      return next
    }
    if (!channel.rxIsEmpty()) {
      assert(!address.isRoot())
      if (!rxs.includes(channelId)) {
        rxs = [...rxs, channelId]
      }
    } else {
      if (rxs.includes(channelId)) {
        rxs = rxs.filter((id) => id !== channelId)
        if (address.isInvalid()) {
          // TODO delete the channel from the list and clean up aliases
        }
      }
    }
    if (rxs !== this.rxs) {
      // ensure loopback, parent, and io come before others
      rxs.sort((a, b) => a - b)
      // TODO do this check on incoming interpulses
    }
    if (!channel.tx.isEmpty()) {
      assert(!address.isRoot())
      const isRegular = !address.isIo() && address.isResolved()
      if (!txs.includes(channelId) && (isRegular || channel.isForkPoint())) {
        txs = [...txs, channelId]
      }
    } else {
      if (txs.includes(channelId)) {
        txs = txs.filter((id) => id !== channelId)
      }
    }

    const next = this.setMap({ rxs, txs })
    const { latest } = channel.rx
    if (!latest) {
      return next
    }
    if (previous && previous.rx.latest && latest.equals(previous.rx.latest)) {
      return next
    }
    // latests has updated, so update the state tree
    const { cxs = [] } = this
    if (cxs.includes(channelId)) {
      return next
    }
    cxs.push(channelId)
    return next.setMap({ cxs })
  }
  async getTx(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(this.txs.includes(channelId))
    const { tx } = await this.list.get(channelId)
    assert(!tx.isEmpty())
    return tx
  }
  async blankTxs(precedent) {
    assert(precedent instanceof PulseLink)
    let { list } = this
    for (const channelId of this.txs) {
      let channel = await list.get(channelId)
      assert(!channel.tx.isEmpty())
      const tx = channel.tx.blank(precedent)
      channel = channel.setMap({ tx })
      list = await list.set(channelId, channel)
    }
    return this.setMap({ list, txs: [] })
  }
  async ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { source } = interpulse
    const isAddress = await this.hasAddress(source)
    if (!isAddress) {
      const pulseLink = interpulse.getHistoricalPulseLink()
      throw new Error(`No address: ${source} from interpulse ${pulseLink}`)
    }
    let channel = await this.getByAddress(source)
    channel = channel.ingestInterpulse(interpulse)
    return await this.updateChannel(channel)
  }
  async *rxChannels() {
    for (const channelId of this.rxs) {
      const channel = await this.getChannel(channelId)
      assert(!channel.rxIsEmpty())
      yield channel
    }
  }
}
