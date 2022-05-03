import assert from 'assert-fast'
import Debug from 'debug'
import {
  PulseLink,
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
  Tx,
} from '.'
import { Hamt } from './Hamt'
import { IpldStruct } from './IpldStruct'
const debug = Debug('interblock:ipld:Network')
// values are significant in that they dictate order of exhaustion
const FIXED = { LOOPBACK: 0, PARENT: 1, IO: 2 }
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
  static FIXED_IDS = FIXED
  static classMap = {
    channels: Channels,
    addresses: AddressesHamt,

    children: ChildrenHamt,
    uplinks: UplinksHamt,
    downlinks: DownlinksHamt,
    symLinks: Hamt,
    hardlinks: Hamt,

    piercings: Tx,
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
    return Channel.create(FIXED.PARENT)
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
    const channels = await this.channels.updateChannel(parent)
    return this.setMap({ channels })
  }
  async getLoopback() {
    if (await this.channels.has(FIXED.LOOPBACK)) {
      return await this.channels.getChannel(FIXED.LOOPBACK)
    }
    return Channel.createLoopback()
  }
  async updateLoopback(loopback) {
    assert(loopback instanceof Channel)
    loopback = crossover(loopback)
    const channels = await this.channels.updateChannel(loopback)
    return this.setMap({ channels })
  }
  async getIo() {
    if (await this.channels.has(FIXED.IO)) {
      return await this.channels.getChannel(FIXED.IO)
    }
    return Channel.createIo()
  }

  async updateIo(io) {
    assert(io instanceof Channel)
    const { tx } = io
    const next = this
    if (!tx.isEmpty()) {
      io = crossover(io)
      const { rx: piercings } = io
      next.setMap({ piercings })
    }
    const channels = await next.channels.updateChannel(io)
    return next.setMap({ channels })
  }

  async addUplink(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    if (await this.channels.hasAddress(address)) {
      throw new Error(`address already present: ${address.cid}`)
    }
    const channelId = this.channels.counter
    const channel = Channel.create(channelId, address)
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
  async addDownlink(path, address) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    assert(address instanceof Address)
    assert(address.isRemote())
    if (await this.downlinks.has(path)) {
      throw new Error(`path already present: ${path}`)
    }
    const channelId = this.channels.counter
    const channel = Channel.create(channelId, address)
    const channels = await this.channels.addChannel(channel)
    const downlinks = await this.downlinks.setDownlink(path, channelId)
    return this.setMap({ channels, downlinks })
  }

  async resolveDownlink(path, address) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(this.#isForeign(path))
    if (await this.downlinks.has(path)) {
      const channelId = await this.downlinks.get(path)
      let channel = await this.channels.getChannel(channelId)
      channel = channel.resolve(address)
      const channels = await this.channels.updateChannel(channel)
      return this.setMap({ channels })
    } else {
      const channelId = this.channels.counter
      const channel = Channel.create(channelId, address)
      const channels = await this.channels.addChannel(channel)
      assert.strictEqual(await channels.getChannel(channelId), channel)
      const downlinks = await this.downlinks.setDownlink(path, channelId)
      return this.setMap({ downlinks, channels })
    }
  }

  rm(alias) {
    // if it was a child, then we can only fully terminate the chain
    // if it was a link, then we remove the alias mapping
    // if this is the only mapping, then we can remove the channel
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
    if (this.#isForeign(path)) {
      if (await this.downlinks.has(path)) {
        channelId = await this.downlinks.get(path)
      } else {
        channelId = this.channels.counter
        const channel = Channel.create(channelId)
        channels = await this.channels.addChannel(channel)
        assert.strictEqual(await channels.getChannel(channelId), channel)
        downlinks = await downlinks.setDownlink(path, channelId)
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
    channels = await channels.updateChannel(channel)
    return await this.setMap({ channels, downlinks })
  }

  //
  // ie: do not store them in the channel
  // can alter any channel by providing any given alias and replacement channel
  // there are limits on what the next channel can contain if one exists already
  async updateChannel(alias, channel) {
    // use any alias to get a channelId out
    assert(typeof alias === 'string', 'Alias not string')
    assert(alias, 'Alias not string')
    assert(alias !== '.')
    assert(alias !== '..')
    assert(channel instanceof Channel, `Not channel`)

    const { channelId } = await this.aliases.get(alias) // throws if not present
    assert.strictEqual(channelId, channel.channelId)
    const channels = this.channels.updateChannel(channel)
    return this.setMap({ channels })
  }
  addChannel(alias, channel, systemRole = './') {}
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

  #isForeign(path) {
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
    const channelId = this.channels.counter
    let channel = Channel.create(channelId, address)
    channel = channel.txGenesis(params)

    const channels = await this.channels.addChannel(channel)
    const children = await this.children.addChild(path, channelId)

    return this.setMap({ channels, children })
  }

  async ingestInterpulse(interpulse) {
    const channels = await this.channels.ingestInterpulse(interpulse)
    return this.setMap({ channels })
  }
  async rxSystemRequest() {
    for await (const channel of this.channels.rxChannels()) {
      const rxRequest = channel.rxSystemRequest()
      if (rxRequest) {
        return rxRequest
      }
    }
  }
  async rxSystemReply() {
    for await (const channel of this.channels.rxChannels()) {
      const rxReply = channel.rxSystemReply()
      if (rxReply) {
        return rxReply
      }
    }
  }
  async rxReducerRequest() {
    for await (const channel of this.channels.rxChannels()) {
      const rxRequest = channel.rxReducerRequest()
      if (rxRequest) {
        return rxRequest
      }
    }
  }
  async rxReducerReply() {
    for await (const channel of this.channels.rxChannels()) {
      const rxReply = channel.rxReducerReply()
      if (rxReply) {
        return rxReply
      }
    }
  }

  // fundamentally, once you pass the request to us, we'll never give it back again
  async txSystemReply(reply = Reply.create()) {
    // by default, this resolves the current request
    const rxRequest = await this.rxSystemRequest()
    assert(rxRequest instanceof RxRequest)
    const { channelId } = rxRequest
    let channel = await this.channels.getChannel(channelId)
    channel = channel.txSystemReply(reply)
    const channels = await this.channels.updateChannel(channel)
    return this.setMap({ channels })
  }
  async shiftSystemReply() {
    const rxReply = await this.rxSystemReply()
    assert(rxReply instanceof RxReply)
    const { channelId } = rxReply
    let channel = await this.channels.getChannel(channelId)
    channel = channel.shiftSystemReply()
    const channels = await this.channels.updateChannel(channel)
    return this.setMap({ channels })
  }
  async txReducerReply(reply = Reply.create()) {
    // by default, this resolves the current request
    const rxRequest = await this.rxReducerRequest()
    assert(rxRequest instanceof RxRequest)
    const { channelId } = rxRequest
    let channel = await this.channels.getChannel(channelId)
    channel = channel.txReducerReply(reply)
    const channels = await this.channels.updateChannel(channel)
    return this.setMap({ channels })
  }
  async shiftReducerReply() {
    const rxReply = await this.rxReducerReply()
    assert(rxReply instanceof RxReply)
    const { channelId } = rxReply
    let channel = await this.channels.getChannel(channelId)
    channel = channel.shiftReducerReply()
    const channels = await this.channels.updateChannel(channel)
    return this.setMap({ channels })
  }
}
const crossover = (channel) => {
  if (!channel.tx.isEmpty()) {
    let { tx, rx, address } = channel
    const system = rx.system.ingestTxQueue(tx.system)
    const reducer = rx.reducer.ingestTxQueue(tx.reducer)
    const { tip = PulseLink.createCrossover(address) } = rx
    rx = rx.setMap({ tip, system, reducer })
    tx = tx.blank(tip)
    channel = channel.setMap({ tx, rx })
  }
  return channel
}
