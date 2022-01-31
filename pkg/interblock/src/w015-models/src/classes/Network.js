import assert from 'assert-fast'
import Immutable from 'immutable'
import { channelSchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import { Channel, Address, RxRequest } from '.'
import Debug from 'debug'
const debug = Debug('interblock:classes:Network')
// TODO merge this with Conflux ?
// TODO assert that no channel has an identical hash during the hashing process ?

const networkSchema = {
  title: 'Network',
  // description: `All communication in and out of this blockchain.`,
  type: 'object',
  required: ['..', '.'],
  additionalProperties: false,
  minProperties: 2,
  patternProperties: { '(.*?)': channelSchema },
}

export class Network extends mixin(networkSchema) {
  #txs = Immutable.Set() // any channel that is transmitting
  #addressMap = Immutable.Map()
  #unresolvedAliases = Immutable.Set()
  static create(channels = {}) {
    assert.strictEqual(typeof channels, 'object')
    assert(!channels['.'])
    assert(!channels['..'])
    const params = {
      '..': Channel.create(Address.create(), '..'),
      '.': Channel.createLoopback(),
      ...channels,
    }
    return super.create(params)
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
  _imprint(next) {
    assert(next instanceof Network)
    assert(next !== this)
    next.#txs = this.#txs
    next.#addressMap = this.#addressMap
    next.#unresolvedAliases = this.#unresolvedAliases
  }
  getUnresolvedAliases() {
    return this.#unresolvedAliases
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
