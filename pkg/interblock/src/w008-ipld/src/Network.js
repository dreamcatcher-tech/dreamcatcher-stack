import assert from 'assert-fast'
import Debug from 'debug'
import {
  RxRequest,
  RxReply,
  Channel,
  Address,
  Channels,
  ChildrenHamt,
  DownlinksHamt,
  UplinksHamt,
  AddressesHamt,
  Request,
  Reply,
} from '.'
import { Hamt } from './Hamt'
import { IpldStruct } from './IpldStruct'
const debug = Debug('interblock:ipld:Network')
const FIXED = { PARENT: 0, LOOPBACK: 1, IO: 2 }

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
    channels: Channels,
    addresses: AddressesHamt,

    children: ChildrenHamt,
    uplinks: UplinksHamt,
    downlinks: DownlinksHamt,
    symLinks: Hamt,
    hardlinks: Hamt,
  }

  static async createRoot() {
    const parent = Channel.createRoot()
    let instance = Network.create()
    instance = await instance.updateParent(parent)
    return instance
  }
  static create() {
    const channels = Channels.create()
    const downlinks = DownlinksHamt.create()
    const uplinks = UplinksHamt.create()
    const children = ChildrenHamt.create()
    let instance = super.clone({ channels, downlinks, uplinks, children })
    return instance
  }
  async getParent() {
    if (await this.channels.has(FIXED.PARENT)) {
      return await this.channels.getChannel(FIXED.PARENT)
    }
    return Channel.create()
  }
  async resolveParent(parentAddress) {
    assert(parentAddress instanceof Address)
    assert(parentAddress.isRemote())
    let parent = await this.getParent()
    assert(parent.getAddress().isUnknown())
    parent = parent.resolve(parentAddress)
    return await this.updateParent(parent)
  }
  async updateParent(parent) {
    assert(parent instanceof Channel)
    const channels = await this.channels.updateChannel(FIXED.PARENT, parent)
    return this.setMap({ channels })
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
    return this.setMap({ channels })
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
    return await this.channels.hasAddress(address)
  }
  async getByAddress(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    return await this.channels.getByAddress(address)
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

  async ingestInterpulse(interpulse) {
    const channels = await this.channels.ingestInterpulse(interpulse)
    return this.setMap({ channels })
  }
  async rxSystemRequest() {
    for await (const [channelId, channel] of this.channels.rxChannels()) {
      const rxRequest = channel.rx.rxSystemRequest(channelId)
      if (rxRequest) {
        return rxRequest
      }
    }
  }
  async rxSystemReply() {
    for await (const [channelId, channel] of this.channels.rxChannels()) {
      const rxReply = channel.rx.rxSystemReply(channelId)
      if (rxReply) {
        return rxReply
      }
    }
  }
  async rxReducerRequest() {}
  async rxReducerReply() {}

  // fundamentally, once you pass the request to us, we'll never give it back again
  async txSystemReply(reply = Reply.create()) {
    // by default, this resolves the current request
    const rxRequest = await this.rxSystemRequest()
    assert(rxRequest instanceof RxRequest)
    const { channelId } = rxRequest
    let channel = await this.channels.getChannel(channelId)
    channel = channel.txSystemReply(reply)
    const channels = await this.channels.updateChannel(channelId, channel)
    return this.setMap({ channels })
  }
  async shiftSystemReply() {
    const rxReply = await this.rxSystemReply()
    assert(rxReply instanceof RxReply)
    const { channelId } = rxReply
    let channel = await this.channels.getChannel(channelId)
    channel = channel.shiftSystemReply()
    const channels = await this.channels.updateChannel(channelId, channel)
    return this.setMap({ channels })
  }
}
