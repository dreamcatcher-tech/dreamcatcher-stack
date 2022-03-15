import assert from 'assert-fast'
import Immutable from 'immutable'
import Debug from 'debug'
import { Channel, Address } from '.'
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
        addresses { Address : Int }
    }
 */
export class Network extends IpldStruct {
  // #txs = Immutable.Set() // any channel that is transmitting
  // #addressMap = Immutable.Map()
  // #unresolvedAliases = Immutable.Set()
  static create() {
    const parent = Channel.create()
    const loopback = Channel.createLoopback()
    const channels = Immutable.Map().set(0, parent).set(1, loopback)
    const counter = 2
    const aliases = Immutable.Map().set('..', 0).set('.', 1)
    return super.clone({ counter, channels, aliases })
  }
  assertLogic() {
    assert(!this.has(undefined))
    assert(this.has('..'))
    assert(this.has('.'))
    assert(this.get('.') instanceof Channel, 'channel invalid')
    assert(this.get('.').systemRole === '.', `self not loopback channel`)
    assert(this.get('..').systemRole === '..', `parent role invalid`)
    // TODO build up the maps after a restore event ?
  }
  static async uncrush(rootCid, resolver, options) {
    assert(rootCid instanceof CID, `rootCid must be a CID, got ${rootCid}`)
    assert(typeof resolver === 'function', `resolver must be a function`)
    const hamtRoot = await resolver(rootCid)

    const map = { ...block.value }
    for (const key in map) {
      if (map[key] instanceof CID) {
        const childClass = this.getClassFor(key)
        map[key] = await childClass.uncrush(map[key], resolver, options)
      }
    }
    const instance = new this()
    Object.assign(instance, map)
    // instance.#ipldBlock = block
    instance.deepFreeze()
    return instance
  }
  async loadAddresses(addresses, getter) {
    assert(Array.isArray(addresses))
    assert(addresses.every((a) => a instanceof Address))
    assert.strictEqual(typeof getter, 'function')
    const awaits = addresses.map((a) => {})
  }
  async loadAliases(aliases, getter) {
    assert(Array.isArray(aliases))
    assert(aliases.every((s) => typeof s === 'string'))
    assert.strictEqual(typeof getter, 'function')
    const awaits = aliases.map(async (s) => {
      const alias = await getter(s)
    })
    // walk through all aliases
    // load all from hamt, then cache the gets
    // when start using the object, we use the cache only and throw if something gets missed

    // once all required aliases are loaded, then load all the channelids
  }
  async loadIds(ids, getter) {
    assert(Array.isArray(ids))
    assert(ids.every((i) => Number.isInteger(i) && i >= 0))
    assert.strictEqual(typeof getter, 'function')
  }
  // _imprint(next) {
  //   assert(next instanceof Network)
  //   assert(next !== this)
  //   next.#txs = this.#txs
  //   next.#addressMap = this.#addressMap
  //   next.#unresolvedAliases = this.#unresolvedAliases
  // }
  getUnresolvedAliases() {
    // return this.#unresolvedAliases
  }
  set(alias, channel) {
    assert.strictEqual(typeof alias, 'string')
    assert(channel instanceof Channel)
    const next = super.set(alias, channel)
    if (this.has(alias)) {
      const { address } = this.get(alias)
      if (!address.isUnknown()) {
        next.#addressMap = this.#addressMap.remove(address.getChainId())
      }
    }
    next.#txs = this.#txs.remove(alias)
    if (!channel.address.isUnknown() && !channel.address.isInvalid()) {
      const chainId = channel.address.getChainId()
      next.#addressMap = this.#addressMap.set(chainId, alias)
      next.#unresolvedAliases = this.#unresolvedAliases.delete(alias)
      if (channel.isTransmitting() && alias !== '.') {
        next.#txs = next.#txs.add(alias)
      }
    } else {
      next.#unresolvedAliases = this.#unresolvedAliases.add(alias)
    }
    return next
  }
  remove(alias) {
    assert.strictEqual(typeof alias, 'string')
    assert(alias !== '.', `cannot delete self`)
    assert(alias !== '..', `cannot delete parent`)
    const next = super.remove(alias)
    next.#txs = this.#txs.remove(alias)
    const { address } = this.get(alias)
    if (!address.isUnknown() && !address.isInvalid()) {
      next.#addressMap = this.#addressMap.delete(address.getChainId())
    }
    return next
  }
  rename(srcAlias, destAlias) {
    // needed to preserve the hash tree efficiently
    assert.strictEqual(typeof srcAlias, 'string')
    assert.strictEqual(typeof destAlias, 'string')
    assert(srcAlias !== destAlias)
    assert(this.has(srcAlias), `no srcAlias found: ${srcAlias}`)
    assert(!this.has(destAlias), `destAlias exists: ${destAlias}`)

    const src = this.get(srcAlias)
    const next = this.set(destAlias, src).del(srcAlias)
    return next
  }
  hasByAddress(address) {
    assert(address instanceof Address)
    assert(!address.isUnknown())
    return this.#addressMap.has(address.getChainId())
  }
  getByAddress(address) {
    assert(address instanceof Address)
    assert(!address.isUnknown())
    // TODO handle same address referred to twice as different aliases
    const msg = `no channel found for address: ${address.getChainId()}`
    assert(this.#addressMap.has(address.getChainId()), msg)
    const alias = this.#addressMap.get(address.getChainId())
    if (this.has(alias)) {
      return this.get(alias)
    }
  }
  getAlias(address) {
    assert(address instanceof Address)
    assert(!address.isUnknown())
    return this.#addressMap.get(address.getChainId())
  }
  setByAddress(address, channel) {
    assert(address instanceof Address)
    assert(channel instanceof Channel)
    assert(this.hasByAddress(address))
    const alias = this.#addressMap.get(address.getChainId())
    return this.set(alias, channel)
  }
  getTransmittingAliases() {
    return this.#txs.toArray()
  }
  isTransmitting() {
    return !!this.#txs.size
  }
  getParent() {
    return this.get('..')
  }
  getLoopback() {
    return this.get('.')
  }
  getResponse(request) {
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
  getAliases() {
    const aliases = []
    for (const [alias] of this.entries()) {
      aliases.push(alias)
    }
    return aliases
  }
}
