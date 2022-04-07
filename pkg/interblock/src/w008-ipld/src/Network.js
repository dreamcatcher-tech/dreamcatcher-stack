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
    // TODO make the parent be a root address
  }
  static create() {
    const channels = Channels.create()
    const downlinks = DownlinksHamt.create()
    let instance = super.clone({ channels, downlinks })
    return instance
  }
  async #childrenHas(name) {
    return this.children && (await this.children.has(name))
  }
  async #downlinksHas(name) {
    return this.downlinks && (await this.downlinks.has(name))
  }
  async #uplinksHas(name) {
    return this.uplinks && (await this.uplinks.has(name))
  }
  async #addressesHas(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    return this.addresses && (await this.addresses.has(address))
  }
  #addChannel(channel) {
    assert(channel instanceof Channel)
    let counter = Number.isInteger(this.counter) ? this.counter : 0
    const channelId = counter++
    let channels = this.channels || ChannelsHamt.create()
    channels = channels.setChannel(channelId, channel)
    return this.constructor.clone({ ...this, counter, channels })
  }

  #updateChannel(channelId, channel) {
    const channels = this.channels.updateChannel(channelId, channel)
    return this.constructor.clone({ ...this, channels })
  }
  async resolveDownlink(path, address) {
    assert.strictEqual(typeof path, 'string')
    assert(path)
    assert(address instanceof Address)
    assert(address.isRemote())
    assert(this.isForeign(path))
    if (await this.#downlinksHas(path)) {
      const channelId = await this.downlinks.get(path)
      let channel = await this.channels.getChannel(channelId)
      channel = channel.resolve(address)
      return this.#updateChannel(channelId, channel)
    } else {
      const channel = Channel.create(address)
      const channelId = this.channels.counter
      const channels = await this.channels.createChannel(channel)
      assert.strictEqual(await channels.getChannel(channelId), channel)
      const downlinks = this.downlinks.setDownlink(path, channelId)
      return this.constructor.clone({ ...this, downlinks, channels })
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
        channels = await this.channels.createChannel(channel)
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
    // find out
    // if it was a child, then we can only fully terminate the chain
    // if it was a link, then we remove the alias mapping
    // if this is the only mapping, then we can remove the channel
  }
  resolveChannel(alias, address) {
    // this is a oneway operation, so gets an explicit function call
    // action goes on to the tx section of the chain, as all modifications do
    // errors only during crush, if conflicts are found
    // during runtime needs to be as fast as possible
    // renames from covenant will cause problems as won't error directly ?
    // can force them to cross a block boundary
  }

  // must keep alias to channelId mappings private
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
  async delete(alias) {
    // TODO check if any other aliases refer to this channel
    assert.strictEqual(typeof alias, 'string', `Alias must be a string`)
    assert(alias)
    if (alias === '..') {
      throw new Error(`Cannot delete parent`)
    }
    if (alias === '.') {
      throw new Error(`Cannot delete loopback`)
    }
    const { channelId } = await this.aliases.get(alias)
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
}
