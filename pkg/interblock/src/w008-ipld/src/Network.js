import assert from 'assert-fast'
import Debug from 'debug'
import {
  Channel,
  Address,
  Loopback,
  Channels,
  ChildrenHamt,
  DownlinksHamt,
  UplinksHamt,
  AddressesHamt,
  Request,
  Io,
  Interpulse,
} from '.'
import { Hamt } from './Hamt'
import { IpldStruct } from './IpldStruct'
const debug = Debug('interblock:ipld:Network')
/**
type Network struct {
    parent optional Channel
    loopback optional Channel
    io optional Io

    counter optional Int
    channels optional HashMapRoot           # Map of channelIds to Channels
    addresses optional HashMapRoot          # reverse lookup of channels

    # alias maps to channelIds
    children optional HashMapRoot
    uplinks optional HashMapRoot            # keys are channelIds
    downlinks optional HashMapRoot          # keys are paths
    symlinks optional HashMapRoot           # keys are paths without "/"
    hardlinks optional HashMapRoot          # keys are addresses

    rxs optional [ Int ]
    txs optional [ Int ]
}
 */
export class Network extends IpldStruct {
  static classMap = {
    parent: Channel,
    loopback: Loopback,
    io: Io,

    channels: Channels,
    addresses: AddressesHamt,

    children: ChildrenHamt,
    uplinks: UplinksHamt,
    downlinks: DownlinksHamt,
    symLinks: Hamt,
    hardlinks: Hamt,
  }

  static createRoot() {
    const instance = Network.create()
    const parent = Channel.createRoot()
    return instance.setMap({ parent })
  }
  static create() {
    const channels = Channels.create()
    const downlinks = DownlinksHamt.create()
    const uplinks = UplinksHamt.create()
    const children = ChildrenHamt.create()
    const parent = Channel.create()
    let instance = super.clone({
      channels,
      downlinks,
      uplinks,
      children,
      parent,
    })
    return instance
  }
  async addUplink(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    if (await this.channels.hasAddress(address)) {
      throw new Error(`address already present: ${address.cid}`)
    }
    const channel = Channel.create(address)
    const channelId = this.channels.counter
    const channels = await this.channels.addChannel(channel)
    const uplinks = await this.uplinks.set(address, channelId)
    return this.setMap({ channels, uplinks })
  }
  async getUplink(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(await this.uplinks.hasUplink(address))
    const channelId = await this.uplinks.get(address)
    return await this.channels.getChannel(channelId)
  }

  async resolveDownlink(path, address) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(this.isForeign(path))
    if (await this.downlinks.has(path)) {
      const channelId = await this.downlinks.get(path)
      let channel = await this.channels.getChannel(channelId)
      channel = channel.resolve(address)
      const channels = await this.channels.updateChannel(channelId, channel)
      return this.setMap({ channels })
    } else {
      const channel = Channel.create(address)
      const channelId = this.channels.counter
      const channels = await this.channels.addChannel(channel)
      assert.strictEqual(await channels.getChannel(channelId), channel)
      const downlinks = this.downlinks.setDownlink(path, channelId)
      return this.setMap({ downlinks, channels })
    }
  }

  async txRequest(request, path) {
    assert(request instanceof Request)
    assert(typeof path === 'string')
    assert(path)
    if (path === '.') {
      const loopback = this.loopback.txRequest(request)
      return Network.setMap({ loopback })
    } else if (path === '..') {
      const parent = this.parent.txRequest(request)
      return Network.setMap({ parent })
    } else if (path === '.@@io') {
      const io = this.io.txRequest(request)
      return Network.setMap({ io })
    }

    // if the path is a remote path, send it on the downlinks
    // if local, check children, then sym, then hard
    let channelId
    let { channels, downlinks } = this
    if (this.isForeign(path)) {
      if (await this.downlinks.has(path)) {
        channelId = await this.downlinks.get(path)
      } else {
        const channel = Channel.create()
        channelId = this.channels.counter
        channels = await this.channels.addChannel(channel)
        assert.strictEqual(await channels.getChannel(channelId), channel)
        downlinks = downlinks.setDownlink(path, channelId)
      }
    } else {
      if (await this.children.has(path)) {
        channelId = await this.children.get(path)
      } else if (await this.symlinks.has(path)) {
        channelId = await this.symlinks.get(path)
      } else if (await this.hardlinks.has(path)) {
        channelId = await this.hardlinks.get(path)
      }
    }
    let channel = await channels.getChannel(channelId)
    channel = channel.txRequest(request)
    channels = await channels.updateChannel(channelId, channel)
    return await this.setMap({ channels, downlinks })
  }
  rm(alias) {
    // if it was a child, then we can only fully terminate the chain
    // if it was a link, then we remove the alias mapping
    // if this is the only mapping, then we can remove the channel
  }

  //
  // ie: do not store them in the channel
  // can alter any channel by providing any given alias and replacement channel
  // there are limits on what the next channel can contain if one exists already
  async updateChannel(alias, channel) {
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

  aliasChannel(alias, channelId, systemRole = './') {
    // set any number of aliases to a channel
    // updates the channel with the aliases
  }
  addChannel(alias, channel, systemRole = './') {}

  async setChannel(alias, channel, systemRole = './') {
    assert.strictEqual(typeof alias, 'string')
    assert(alias)
    assert(channel instanceof Channel, `must supply Channel`)
    assert.strictEqual(typeof systemRole, 'string')
    debug(`setChannel`, alias, channel, systemRole)
    const { address } = channel.tx
    if (alias === '.') {
      assert(address.isLoopback())
      assert.strictEqual(systemRole, '.')
      assert(this.loopback.isNext(channel))
      return this.set('loopback', channel)
    }
    if (alias === '..') {
      assert.strictEqual(systemRole, '..')
      assert(this.parent.isNext(channel))
      return this.set('parent', channel)
    }
    if (alias === '.@@io') {
      assert.strictEqual(systemRole, 'PIERCE')
      assert(!this.io || this.io.isNext(channel))
      return this.set('io', channel)
    }
    assert(!address.isRoot())
    assert(!address.isLoopback())

    if (await this.hasByAlias(alias)) {
      const previous = await this.getByAlias(alias)
      assert(previous.isNext(channel))
    }

    // update to reflect a resolved address
    if (address.isRemote()) {
      // then we need to store the address in the alias map
    }

    if (alias !== address && !channel.hasAlias(alias)) {
      channel = channel.setAlias(alias)
    }

    let { channels, aliases, counter } = this
    const ref = await aliases.has(address)
    if (ref) {
      // means we have a channelId already
      if (ref.systemRole !== systemRole) {
        aliases = aliases.set(alias, { ...ref, systemRole })
      }
    } else {
      const channelId = counter++
      channels = channels.set(channelId, channel)
    }

    return Network.clone({ ...this, counter, channels, aliases })
  }
  async getByAlias(alias) {
    const { channelId } = await this.aliases.get(alias)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.counter)
    const channel = await this.channels.get(channelId)
    return channel
  }

  async hasByAlias(alias) {
    return await this.aliases.has(alias)
  }
  // async delete(alias) {
  //   // TODO check if any other aliases refer to this channel
  //   assert.strictEqual(typeof alias, 'string', `Alias must be a string`)
  //   assert(alias)
  //   if (alias === '..') {
  //     throw new Error(`Cannot delete parent`)
  //   }
  //   if (alias === '.') {
  //     throw new Error(`Cannot delete loopback`)
  //   }
  //   const { channelId } = await this.aliases.get(alias)
  //   assert(Number.isInteger(channelId))
  //   const channels = this.channels.delete(channelId)
  //   return this.constructor.clone({ ...this, channels })
  // }
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
  async hasAddress(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    if (this.parent.getAddress().equals(address)) {
      return true
    }
    return await this.channels.hasAddress(address)
  }
  async getByAddress(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    if (this.parent.getAddress().equals(address)) {
      return this.parent
    }
    return await this.channels.getByAddress(address)
  }
  getParent() {
    return this.parent
  }
  getLoopback() {
    return this.loopback
  }
  getIo() {
    return this.io
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

  isForeign(path) {
    assert(typeof path === 'string')
    assert(path)
    if (path.startsWith('.')) {
      assert(path.length > 1)
      if (path.startsWith('..')) {
        assert(path.startsWith('../'))
        assert(path.length > 3)
      }
    }
    if (path.startsWith('/')) {
      // if (path.)
    }
    // TODO
    return true
  }
  async txGenesis(path, address, params = {}) {
    assert(typeof path === 'string')
    assert(path)
    assert(!path.includes('/'))
    assert(address instanceof Address)
    assert.strictEqual(typeof params, 'object')
    const channel = Channel.create(address).txGenesis(params)

    const channelId = this.channels.counter
    const channels = await this.channels.addChannel(channel)
    const children = await this.children.addChild(path, channelId)

    return this.setMap({ channels, children })
  }
  setParent(parentAddress) {
    assert(parentAddress instanceof Address)
    assert(this.parent.getAddress().isUnknown())
    const parent = this.parent.resolve(parentAddress)
    return this.setMap({ parent })
  }
  async ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { source } = interpulse
    assert(await this.hasAddress(source))
    if (this.parent.getAddress().equals(source)) {
      const parent = this.parent.ingestInterpulse(interpulse)
      return this.setMap({ parent })
    }
    const channels = await this.channels.ingestInterpulse(interpulse)
    return this.setMap({ channels })
  }
  async rxSystemReply() {
    // check parent, check io,
  }
  async rxReducerReply() {}
  async rxSystemRequest() {
    for await (const channel of this.#rxChannels()) {
      const rxRequest = channel.rx.rxSystemRequest()
      if (rxRequest) {
        return rxRequest
      }
    }
  }
  async rxReducerRequest() {}
  async #rxSystemChannels() {
    // make a function that iterates over all the rx channels that are active
  }
  async #rxReducerChannels() {}
  async *#rxChannels() {
    if (this.loopback && !this.loopback.rx.isEmpty()) {
      yield this.loopback
    }
    if (this.parent && !this.parent.rx.isEmpty()) {
      yield this.parent
    }
    if (this.io && !this.io.rx.isEmpty()) {
      yield this.io
    }
    for (const channelId of this.channels.rxs) {
      yield await this.channels.getChannel(channelId)
    }
  }
}
