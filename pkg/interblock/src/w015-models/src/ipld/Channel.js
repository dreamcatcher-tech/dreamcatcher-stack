import assert from 'assert-fast'
import { Address } from '.'
import Debug from 'debug'
import { IpldStruct } from './IpldStruct'
const debug = Debug('interblock:models:channel')

let loopback
export class Channel extends IpldStruct {
  static create(address = Address.create(), systemRole = 'DOWN_LINK') {
    // TODO calculate systemRole from alias
    assert(address instanceof Address)
    assert.strictEqual(typeof systemRole, 'string')
    const remote = Remote.create({ address })
    const { replies, requests, precedent } = remote
    return super.create({ address, replies, requests, precedent, systemRole })
  }
  static createRoot() {
    const root = Address.create('ROOT')
    return Channel.create(root, '..')
  }
  static createLoopback() {
    if (!loopback) {
      const address = Address.create('LOOPBACK')
      loopback = Channel.create(address, '.')
    }
    return loopback
  }
  assertLogic() {
    // TODO if reset address, must clear all remote requests, else promises break
    // TODO check no duplicate requests in channel - must be distiguishable
    // TODO check that replies keys are always consequtive, and they match
    // the temporaryInterblocks array.  Could only be disjoint if came before
    // the current interblocks, else must be in order, and cannot be beyond
    // The order must match the interblocks for keys, so can walk the conflux
    const {
      address,
      replies,
      requests,
      precedent,
      systemRole,
      rxPromises,
      rxRepliesTip,
      tip,
      tipHeight,
    } = this
    const _isLoopback = systemRole === '.'
    // TODO assert the order of rxPromises and txPromises is sequential
    if (address.isUnknown()) {
      assert.strictEqual(replies.size, 0)
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
      assert.strictEqual(typeof rxPromises, 'undefined')
    }
    // TODO if this is pierce channel, ensure only requests are OOB effects ?

    if (_isLoopback) {
      // TODO check rxRepliesTip matches what is in the reply object
      assert(address.isLoopback())
      assert.strictEqual(typeof tip, 'undefined')
      assert(precedent.isUnknown())
      const banned = ['@@OPEN_CHILD']
      const outs = Object.values(requests)
      assert(outs.every(({ type }) => !banned.includes(type)))
    }
    if (Number.isInteger(tipHeight)) {
      assert(tipHeight >= 0)
      assert(_isLoopback || !tip.isUnknown())
    }
    if (tip) {
      assert(!_isLoopback)
      assert(!tip.isUnknown())
      assert(tipHeight >= 0)
    }
  }
  isTransmitting() {
    return !!this.requests.length || !!this.replies.size
  }
  isLoopback() {
    return this.systemRole === '.'
  }
}
