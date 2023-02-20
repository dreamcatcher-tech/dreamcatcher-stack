import assert from 'assert-fast'
import Debug from 'debug'
import {
  PulseLink,
  HistoricalPulseLink,
  RequestId,
  RxRequest,
  RxReply,
  Channel,
  Address,
  Channels,
  ChildrenHamt,
  DownlinksHamt,
  SymlinksHamt,
  UplinksHamt,
  Request,
  Reply,
  Rx,
} from '.'
import { Hamt } from './Hamt'
import { IpldStruct } from './IpldStruct'
const debug = Debug('interblock:ipld:Network')
// values are significant in that they dictate order of exhaustion
const FIXED = { LOOPBACK: 0, PARENT: 1, IO: 2 }
/**
type Channels struct {
    counter Int
    list HashMapRoot               # Map of channelIds to Channels
    addresses HashMapRoot          # reverse lookup of channels
    rxs [ Int ]
    txs [ Int ]
}
type Network struct {
    channels Channels

    # alias maps to channelIds
    children optional HashMapRoot           # keys are local paths
    downlinks HashMapRoot                   # keys are remote paths
    uplinks optional HashMapRoot            # keys are channelIds, value=true
    symlinks optional HashMapRoot           # local paths : any paths
    hardlinks optional HashMapRoot          # local paths : any paths

    piercings optional Tx
}
 */
export class Network extends IpldStruct {
  static FIXED_IDS = FIXED
  static classMap = {
    channels: Channels,

    children: ChildrenHamt,
    uplinks: UplinksHamt,
    downlinks: DownlinksHamt,
    symlinks: SymlinksHamt,
    hardlinks: Hamt,

    piercings: Rx,
  }

  static async createRoot() {
    const parent = Channel.createRoot()
    let instance = Network.create()
    instance = await instance.updateParent(parent)
    return instance
  }
  static create() {
    const channels = Channels.create()
    const children = ChildrenHamt.create()
    const uplinks = UplinksHamt.create()
    const downlinks = DownlinksHamt.create()
    const symlinks = SymlinksHamt.create()
    const hardlinks = Hamt.create() // TODO move to own class
    let instance = super.clone({
      channels,
      children,
      uplinks,
      downlinks,
      symlinks,
      hardlinks,
    })
    return instance
  }
  async getParent() {
    if (await this.channels.has(FIXED.PARENT)) {
      return await this.channels.getChannel(FIXED.PARENT)
    }
    return Channel.create(FIXED.PARENT).addAlias('..')
  }
  async resolveParent(parentAddress) {
    assert(parentAddress instanceof Address)
    assert(parentAddress.isRemote())
    let parentChannel = await this.getParent()
    assert(parentChannel.address.isUnknown())
    parentChannel = parentChannel.resolve(parentAddress)
    return await this.updateParent(parentChannel)
  }
  async forkUp(parentAddress, precedent, tip) {
    assert(parentAddress instanceof Address)
    assert(parentAddress.isRemote())
    assert(precedent instanceof PulseLink)
    assert(tip instanceof PulseLink)
    let parentChannel = await this.getParent()
    assert(!parentChannel.address.isUnknown())
    parentChannel = parentChannel.forkUp(parentAddress, precedent, tip)
    return await this.updateParent(parentChannel)
  }
  async updateParent(parent) {
    assert(parent instanceof Channel)
    assert.strictEqual(parent.channelId, FIXED.PARENT)
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
    assert.strictEqual(loopback.channelId, FIXED.LOOPBACK)
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
    assert.strictEqual(io.channelId, FIXED.IO)

    const { rx } = io
    let next = this
    if (!rx.isEmpty()) {
      let { piercings = rx } = next
      let { system, reducer } = piercings
      system = system.expandPiercings(rx.system)
      reducer = reducer.expandPiercings(rx.reducer)
      piercings = piercings.setMap({ system, reducer })
      next = next.setMap({ piercings })
    }
    const channels = await next.channels.updateChannel(io)
    return next.setMap({ channels })
  }
  async pierceIo(request) {
    assert(request instanceof Request)
    let io = await this.getIo()
    let { rx } = io
    let { reducer, system, tip } = rx
    tip ??= HistoricalPulseLink.createCrossover(io.address)
    let requestId
    if (request.isSystem()) {
      const requestIndex = system.requestsLength
      requestId = RequestId.create(io.channelId, 'system', requestIndex)
      const requests = [...system.requests, request]
      const requestsLength = system.requestsLength + 1
      system = system.setMap({ requests, requestsLength })
    } else {
      const requestIndex = reducer.requestsLength
      requestId = RequestId.create(io.channelId, 'reducer', requestIndex)
      const requests = [...reducer.requests, request]
      const requestsLength = reducer.requestsLength + 1
      reducer = reducer.setMap({ requests, requestsLength })
    }

    io = io.setMap({ rx: { system, reducer, tip } })
    const next = await this.updateIo(io)
    return [next, requestId]
  }
  async pierceIoReply(reply) {
    // TODO these can only be reducer replies, never system
    // as making an outbound system request is nonsense.
    throw new Error('not implemented')
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
  async resolveDownlink(path, address) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(isForeign(path))
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
  async rm(path) {
    // if it was a child, then we can only fully terminate the chain
    // if it was a link, then we remove the alias mapping
    // if this is the only mapping, then we can remove the channel

    if (!(await this.hasChannel(path))) {
      throw new Error(`no such channel: ${path}`)
    }
    const channel = await this.getChannel(path)
    assert(channel.aliases.includes(path))
    const fixeds = ['.', '..', '.@@io']
    if (fixeds.includes(path)) {
      throw new Error(`cannot remove fixed channel: ${path}`)
    }
    let next = this
    if (await this.symlinks.has(path)) {
      next = next.setMap({ symlinks: await next.symlinks.delete(path) })
    }
    if (await this.children.has(path)) {
      next = next.setMap({ children: await next.children.delete(path) })
    }
    if (await this.downlinks.has(path)) {
      next = next.setMap({ downlinks: await next.downlinks.delete(path) })
    }
    if (await this.hardlinks.has(path)) {
      next = next.setMap({ hardlinks: await next.hardlinks.delete(path) })
    }
    if (channel.aliases.length === 1) {
      next = next.setMap({
        channels: await next.channels.deleteChannel(channel),
      })
    }
    return next
  }
  async addChild(path, address) {
    assert(typeof path === 'string')
    assert(path)
    assert(!path.includes('/'))
    assert(address instanceof Address)
    assert(address.isRemote())
    const channelId = this.channels.counter
    let channel = Channel.create(channelId, address)
    channel = channel.addAlias(path)
    const channels = await this.channels.addChannel(channel)
    const children = await this.children.addChild(path, channelId)
    return this.setMap({ channels, children })
  }
  async hasChild(alias) {
    assert(typeof alias === 'string', 'Alias not string')
    assert(alias)
    return await this.children.has(alias)
  }
  async getChild(alias) {
    assert(typeof alias === 'string', 'Alias not string')
    assert(alias)
    const channelId = await this.children.get(alias)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0 && channelId < this.channels.counter)
    const channel = await this.channels.getChannel(channelId)
    return channel
  }
  async insertFork(path, latest, childSide) {
    assert(typeof path === 'string')
    assert(path)
    assert(!path.includes('/'))
    assert(latest instanceof PulseLink)
    assert(childSide instanceof Channel)

    const channelId = this.channels.counter
    const channel = Channel.create(channelId)
      .addLatest(latest)
      .addAlias(path)
      .syncForkPoint(childSide)

    assert(channel.isForkPoint())
    const channels = await this.channels.addChannel(channel)
    const children = await this.children.addChild(path, channelId)
    return this.setMap({ channels, children })
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

  async txSystemReply(reply = Reply.create()) {
    const rxRequest = await this.rxSystemRequest()
    assert(rxRequest instanceof RxRequest)
    const { channelId } = rxRequest.requestId
    let channel = await this.channels.getChannel(channelId)
    channel = channel.txSystemReply(reply)
    const next = await this.updateChannel(channel)
    return next
  }
  async shiftSystemReply() {
    const rxReply = await this.rxSystemReply()
    assert(rxReply instanceof RxReply)
    const { channelId } = rxReply.requestId
    let channel = await this.channels.getChannel(channelId)
    channel = channel.shiftSystemReply()
    const next = await this.updateChannel(channel)
    return next
  }
  async txReducerReply(reply = Reply.create()) {
    const rxRequest = await this.rxReducerRequest()
    assert(rxRequest instanceof RxRequest)
    const { channelId } = rxRequest.requestId
    let channel = await this.channels.getChannel(channelId)
    channel = channel.txReducerReply(reply)
    const next = await this.updateChannel(channel)
    return next
  }
  async shiftReducerReply() {
    const rxReply = await this.rxReducerReply()
    assert(rxReply instanceof RxReply)
    const { channelId } = rxReply.requestId
    let channel = await this.channels.getChannel(channelId)
    channel = channel.shiftReducerReply()
    const next = await this.updateChannel(channel)
    return next
  }
  async settlePromise(rxReply) {
    assert(rxReply instanceof RxReply)
    assert(!rxReply.isPromise())
    const { channelId } = rxReply.requestId
    let channel = await this.channels.getChannel(channelId)
    channel = channel.settlePromise(rxReply)
    const next = await this.updateChannel(channel)
    return next
  }

  // OPERATIONS BY PATH FROM REDUCER
  async hasChannel(path) {
    // TODO make a hamt to store all aliases, else may have race conditions between hamts
    assert.strictEqual(typeof path, 'string')
    assert(path)
    const fixeds = ['.', '..', '.@@io']
    if (fixeds.includes(path)) {
      return true
    }
    if (path === '/') {
      const parent = await this.getParent()
      if (parent.address.isRoot()) {
        return true
      }
    }
    if (await this.symlinks.has(path)) {
      return true
    }
    if (await this.children.has(path)) {
      return true
    }
    if (await this.downlinks.has(path)) {
      return true
    }
    if (await this.hardlinks.has(path)) {
      return true
    }
    return false
  }
  async addDownlink(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    assert(isForeign(path), `path must be foreign: ${path}`)
    if (await this.downlinks.has(path)) {
      throw new Error(`path already present: ${path}`)
    }
    const channelId = this.channels.counter
    const channel = Channel.create(channelId).addAlias(path)
    const channels = await this.channels.addChannel(channel)
    const downlinks = await this.downlinks.setDownlink(path, channelId)

    return this.setMap({ channels, downlinks })
  }
  async getChannel(path) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    if (path === '.') {
      return await this.getLoopback()
    } else if (path === '..') {
      return await this.getParent()
    } else if (path === '.@@io') {
      return await this.getIo()
    } else if (path === '/') {
      const parent = await this.getParent()
      if (parent.address.isRoot()) {
        return await this.getLoopback()
      }
    }

    let channelId
    if (await this.children.has(path)) {
      channelId = await this.children.get(path)
    }
    if (await this.downlinks.has(path)) {
      channelId = await this.downlinks.get(path)
    }
    if (await this.hardlinks.has(path)) {
      channelId = await this.hardlinks.get(path)
    }
    if (!channelId) {
      throw new Error(`non existent path: ${path}`)
    }
    return await this.channels.getChannel(channelId)
  }
  async updateChannel(channel) {
    assert(channel instanceof Channel, `Not channel`)
    switch (channel.channelId) {
      case FIXED.PARENT: {
        return this.updateParent(channel)
      }
      case FIXED.LOOPBACK: {
        return this.updateLoopback(channel)
      }
      case FIXED.IO: {
        return this.updateIo(channel)
      }
    }
    const channels = await this.channels.updateChannel(channel)
    return this.setMap({ channels })
  }
  async blankTxs(precedent) {
    assert(precedent instanceof PulseLink)
    let io = await this.getIo()
    let next = this
    if (!io.tx.isEmpty()) {
      const tx = io.tx.blank(precedent)
      io = io.setMap({ tx })
      next = await next.updateIo(io)
    }
    const channels = await next.channels.blankTxs(precedent)
    return next.setMap({ channels })
  }
  async setSymlink(linkName, target) {
    if (await this.hasChannel(linkName)) {
      throw new Error(`name in use: ${linkName} for: ${target}`)
    }
    const symlinks = await this.symlinks.set(linkName, target)
    return this.setMap({ symlinks })
  }
  async isSymlink(linkName) {
    assert.strictEqual(typeof linkName, 'string')
    assert(linkName)
    return await this.symlinks.has(linkName)
  }
  async resolveSymlink(linkName) {
    return await this.symlinks.get(linkName)
  }
  async setHardlink(name, address) {
    assert.strictEqual(typeof name, 'string')
    assert(name)
    assert(address instanceof Address)
    assert(address.isRemote(), `address must be remote: ${name}:${address}`)
    if (await this.hasChannel(name)) {
      throw new Error(`name in use: ${name} for: ${address}`)
    }
    // TODO make channels create the channelId to avoid race conditions
    const channelId = this.channels.counter
    const channel = Channel.create(channelId, address).addAlias(name)
    const channels = await this.channels.addChannel(channel)
    const hardlinks = await this.hardlinks.set(name, channelId)
    return this.setMap({ channels, hardlinks })
  }
  async connectPublicly(source) {
    assert(source instanceof Address)
    assert(source.isRemote(), `target must be remote: ${source}`)
    const isChannel = await this.channels.hasAddress(source)
    assert(!isChannel, `target is already a channel: ${source}`)
    const channelId = this.channels.counter
    const channel = Channel.create(channelId, source)
    const channels = await this.channels.addChannel(channel)
    return this.setMap({ channels })
  }
}
const crossover = (channel) => {
  if (!channel.tx.isEmpty()) {
    let { tx, rx, address } = channel
    const system = rx.system.ingestTxQueue(tx.system)
    const reducer = rx.reducer.ingestTxQueue(tx.reducer)
    const { tip = HistoricalPulseLink.createCrossover(address) } = rx
    rx = rx.setMap({ tip, system, reducer })
    tx = tx.blank(tip)
    channel = channel.setMap({ tx, rx })
  }
  return channel
}
const isForeign = (path) => {
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
  if (!path.includes('/')) {
    return false
  }
  // TODO
  return true
}
