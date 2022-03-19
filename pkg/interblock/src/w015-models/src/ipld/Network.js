import assert from 'assert-fast'
import Immutable from 'immutable'
import Debug from 'debug'
import { Channel, Address } from '.'
import { Hamt } from './Hamt'
import { IpldStruct } from './IpldStruct'
const debug = Debug('interblock:classes:Network')
/**
    type SystemRoles enum {
        | PARENT("..")
        | LOOPBACK(".")
        | CHILD("./")
        | UP_LINK
        | DOWN_LINK
        | PIERCE
    }
    type Alias struct {
        systemRole SystemRoles
        channelId Int
    }
    type Network struct {
        counter Int
        channels { String : Channel }   # Map of channelIds to channels
        aliases { String : Alias }      # Map of aliases to channelIds
        addresses { String : Int }
    }
 */
export class Network extends IpldStruct {
  static createRoot() {
    // make the parent be a root address
  }
  static create() {
    const counter = 0
    const channels = Hamt.create()
    const aliases = Hamt.create()
    const addresses = Hamt.create()
    let instance = super.clone({ counter, channels, aliases, addresses })

    const parent = Channel.create()
    const loopback = Channel.createLoopback()

    instance = instance.setChannel('..', parent).setChannel('.', loopback)
    return instance
  }
  setChannel(alias, channel, systemRole = './') {
    assert.strictEqual(typeof alias, 'string')
    assert(channel instanceof Channel, `must supply Channel`)
    assert.strictEqual(typeof systemRole, 'string')
    const channelId = this.counter
    const counter = this.counter + 1
    const channels = this.channels.set(channelId, channel)
    let { addresses } = this
    const address = channel.tx.genesis
    if (address.isResolved()) {
      addresses = addresses.set(address.cid.toString(), channelId)
    }
    const aliases = this.aliases.set(alias, { channelId, systemRole })

    return Network.clone({ counter, channels, aliases, addresses })
  }
  getByAlias(alias) {
    const { channelId } = this.aliases.get(alias)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.counter)
    const channel = this.channels.get(channelId)
    return channel
  }
  delete(alias) {
    // TODO check if any other aliases refer to this channel
    const { channelId } = this.aliases.get(alias)
    assert(Number.isInteger(channelId))
    const parentId = 0
    const loopbackId = 1
    if (channelId === parentId) {
      throw new Error(`Cannot delete parent`)
    }
    if (channelId === loopbackId) {
      throw new Error(`Cannot delete loopback`)
    }
    const channels = this.channels.delete(channelId)
    return this.constructor.clone({ ...this, channels })
  }
  assertLogic() {
    // assert(this.counter >= 2)
    // assert(this.aliases.has('..'))
    // assert(this.has('.'))
    // assert(this.get('.') instanceof Channel, 'channel invalid')
    // assert(this.get('.').systemRole === '.', `self not loopback channel`)
    // assert(this.get('..').systemRole === '..', `parent role invalid`)
  }
  async ensureAddresses(addresses, resolver) {
    assert(Array.isArray(addresses))
    assert(addresses.every((a) => a instanceof Address))
    assert.strictEqual(typeof resolver, 'function')
    const awaits = addresses.map((a) => {})
  }
  async ensureAliases(aliases, resolver) {
    assert(Array.isArray(aliases))
    assert(aliases.every((s) => typeof s === 'string'))
    assert.strictEqual(typeof resolver, 'function')
    const awaits = aliases.map(async (s) => {
      const alias = await resolver(s)
    })
    // walk through all aliases
    // load all from hamt, then cache the gets
    // when start using the object, we use the cache only and throw if something gets missed

    // once all required aliases are loaded, then load all the channelids
  }
  rename(srcAlias, destAlias) {
    // needed to preserve the hash tree efficiently
    assert.strictEqual(typeof srcAlias, 'string')
    assert.strictEqual(typeof destAlias, 'string')
    assert(srcAlias !== destAlias)
    assert(this.has(srcAlias), `no srcAlias found: ${srcAlias}`)
    assert(!this.has(destAlias), `destAlias exists: ${destAlias}`)

    // TODO use channelIds to make rename easy
  }
  getByAddress(address) {
    assert(address instanceof Address)
    assert(address.isResolved())
    const channelId = this.addresses.get(address.cid.toString())
    const msg = `no channel found for address: ${address.getChainId()}`
    assert(Number.isInteger(channelId), msg)
    const channel = this.channels.get(channelId)
    assert(channel instanceof Channel)
    return channel
  }
  getParent() {
    return this.getByAlias('..')
  }
  getLoopback() {
    return this.getByAlias('.')
  }
  getResponse(request) {
    // TODO move to use channelIds
    assert(request instanceof RxRequest)
    const address = request.getAddress()
    const channel = this.getByAddress(address)
    const replyKey = request.getReplyKey()
    if (!channel.replies.has(replyKey)) {
      return
    }
    const reply = channel.replies.get(replyKey)
    return reply
  }
}
