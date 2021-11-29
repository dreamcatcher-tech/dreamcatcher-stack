import assert from 'assert-fast'
import Immutable from 'immutable'
import { channelSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
import { Channel, Address } from '.'

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
  static create() {
    const params = {
      '..': Channel.create(Address.create(), '..'),
      '.': Channel.createLoopback(),
    }
    return super.create(params)
  }

  set(alias, channel) {
    assert(channel instanceof Channel)
    const next = super.set(alias, channel)
    if (this.has(alias)) {
      const { address } = this.get(alias)
      next.#addressMap = this.#addressMap.remove(address)
    }
    next.#txs = this.#txs.remove(alias)
    next.#addressMap = this.#addressMap.set(channel.address, alias)
    if (channel.isTransmitting()) {
      next.#txs = next.#txs.add(alias)
    }
    return next
  }
  remove(alias) {
    assert.strictEqual(typeof alias, 'string')
    assert(alias !== '.', `cannot delete self`)
    assert(alias !== '..', `cannot delete parent`)
    const next = super.remove(alias)
    next.#txs = this.#txs.remove(alias)
    const { address } = next.get(alias)
    next.#addressMap = this.#addressMap.delete(address)
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
  getByAddress(address) {
    assert(address instanceof Address)
    const alias = this.#addressMap.get(address)
    return this.get(alias)
  }
  getTxs() {
    // return an object that has all the transmissions within it
    throw new Error()
  }
  blankTransmissions() {
    // set all channels untransmitting
    throw new Error()
  }
}
