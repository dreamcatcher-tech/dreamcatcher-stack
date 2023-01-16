import { Hamt } from './Hamt'
import { Address } from '.'
import assert from 'assert-fast'
export class AddressesHamt extends Hamt {
  get isBakeSkippable() {
    return true
  }
  async set(address, channelId) {
    assert(address instanceof Address)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(address.isRemote())
    const key = address.getChainId()
    return await super.set(key, channelId)
  }
  async has(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    return await super.has(address.getChainId())
  }
  async delete(address) {
    assert(await this.has(address), `address not present ${address}`)
    return await super.delete(address.getChainId())
  }
  async get(address) {
    assert(address instanceof Address)
    return await super.get(address.getChainId())
  }
  async compare(other) {
    let { added, deleted, modified } = await super.compare(other)
    added = new Set([...added].map((key) => Address.fromChainId(key)))
    deleted = new Set([...deleted].map((key) => Address.fromChainId(key)))
    modified = new Set([...modified].map((key) => Address.fromChainId(key)))
    return { added, deleted, modified }
  }
}
