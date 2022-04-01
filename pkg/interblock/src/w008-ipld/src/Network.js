import assert from 'assert-fast'
import Debug from 'debug'
import { Channel, Address, Loopback, Tx, Rx } from '.'
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
        loopback Channel
        parent Channel
        rxIds [ Int ]
        txs [ &Tx ]        
    }
 */
export class Network extends IpldStruct {
  static classMap = {
    channels: Hamt,
    aliases: Hamt,
    loopback: Loopback,
    parent: Channel,
    rxIds: Rx,
    txs: Tx,
  }
  static createRoot() {
    // make the parent be a root address
  }
  static create() {
    const counter = 0
    const channels = Hamt.create()
    const aliases = Hamt.create()
    const parent = Channel.create()
    const loopback = Loopback.createLoopback()
    let instance = super.clone({
      counter,
      channels,
      aliases,
      parent,
      loopback,
    })
    return instance
  }
  // must keep alias to channelId mappings private
  // ie: do not store them in the channel
  // can alter any channel by providing any given alias and replacement channel
  // there are limits on what the next channel can contain if one exists already
  async updateChannel( alias, channel ){
    // use any alias to get a channelId out
    assert(channel instanceof Channel)
    assert(typeof alias === 'string')
    assert(alias)
    assert(alias !== '.')
    assert(alias !== '..')

    const { channelId } = await this.aliases.get(alias) // throws if not present
    const channels = this.channels.set(channelId, channel)
    return this.constructor.clone({ ...this, channels })
  }


  aliasChannel( alias, channelId, systemRole = './') {
    // set any number of aliases to a channel
    // updates the channel with the aliases
  }
  addChannel( alias, channel, systemRole = './') {

  }
  


  async setChannel(alias, channel, systemRole = './') {
    assert.strictEqual(typeof alias, 'string')
    assert(alias)
    assert(channel instanceof Channel, `must supply Channel`)
    assert.strictEqual(typeof systemRole, 'string')
    const address = channel.tx.genesis
    if (alias === '.') {
      assert(address.isLoopback())
      assert.strictEqual(systemRole, '.')
      // TODO check it is greater than the current
      return this.set('loopback', channel)
    }
    if (alias === '..') {
      assert.strictEqual(systemRole, '..')
      return this.set('parent', channel)
    }
    assert(!address.isRoot())
    assert(!address.isLoopback())

    // update to reflect a resolved address
    if (address.isRemote()){
      // then we need to store the address in the alias map
    }

    // 


    if (alias !== address && !channel.hasAlias(alias)){
      channel = channel.setAlias(alias)
    }

    let {channels, aliases, counter} = this
    const ref = await aliases.has(address)
    if (ref) {
      // means we have a channelId already
      if (ref.systemRole !== systemRole){
        aliases =       aliases.set(alias, { ...ref, systemRole })
      }

    } else {
      const channelId = counter++
      channels = channels.set(channelId, channel)
      
    }

    .set(.cid.toString(), { channelId, systemRole })
    return Network.clone({ ...this, counter, channels, aliases })
  }
  getByAlias(alias) {
    const { channelId } = this.aliases.get(alias)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.counter)
    const channel = this.channels.get(channelId)
    return channel
  }
  hasByAlias(alias) {
    return this.aliases.has(alias)
  }
  delete(alias) {
    // TODO check if any other aliases refer to this channel
    assert.strictEqual(typeof alias, 'string', `Alias must be a string`)
    assert(alias)
    if (alias === '..') {
      throw new Error(`Cannot delete parent`)
    }
    if (alias === '.') {
      throw new Error(`Cannot delete loopback`)
    }
    const { channelId } = this.aliases.get(alias)
    assert(Number.isInteger(channelId))
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
    return this.parent
  }
  getLoopback() {
    return this.loopback
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
  isInterblockAddable(interblock) {
    assert(interblock instanceof Interblock)
    const address = interblock.provenance.getAddress()
    const channel = this.network.getByAddress(address)
    if (!channel) {
      return false
    }
    // TODO check against tip parameters fully
    // TODO check turnovers
    if (!Number.isInteger(channel.tipHeight)) {
      return true
    }
    return channel.tipHeight < interblock.provenance.height
  }
}
