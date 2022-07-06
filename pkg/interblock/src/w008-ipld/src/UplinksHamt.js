import { Hamt } from './Hamt'
import { Address } from '.'
import assert from 'assert-fast'

export class UplinksHamt extends Hamt {
  static create() {
    return super.create()
  }
  async set(address, channelId) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    const key = address.cid.toString()
    if (await super.has(key)) {
      throw new Error(`address already uplinked: ${address.cid}`)
    }
    return super.set(key, channelId)
  }
  async get(address) {
    assert(address instanceof Address)
    return await super.get(address.cid.toString())
  }
  async hasUplink(address) {
    assert(address instanceof Address)
    return await super.has(address.cid.toString())
  }
  delete(channelId) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.counter)
  }
}
