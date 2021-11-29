import assert from 'assert-fast'
import { RxRequest, RxReply, Continuation, Address, Remote } from '.'
import { channelSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'

let loopback
export class Channel extends mixin(channelSchema) {
  static create(address = Address.create(), systemRole = 'DOWN_LINK') {
    // TODO calculate systemRole from alias
    assert(address instanceof Address)
    assert.strictEqual(typeof systemRole, 'string')
    const remote = Remote.create({ address })
    const { replies, requests, precedent } = remote
    return super.create({ address, replies, requests, precedent, systemRole })
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
      assert.strictEqual(Object.keys(replies).length, 0)
      assert.strictEqual(typeof tip, 'undefined')
      assert.strictEqual(typeof tipHeight, 'undefined')
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
    return !!this.requests.length || !!Object.keys(this.replies).length
  }
  isLoopback() {
    return this.systemRole === '.'
  }

  static #splitKey(key) {
    const [sHeight, sIndex] = key.split('_')
    const height = Number.parseInt(sHeight)
    const index = Number.parseInt(sIndex)
    return [height, index]
  }

  rxLoopbackSettle() {
    let _rxPromises = this.rxPromises || []
    for (const promisedKey of _rxPromises) {
      const reply = this.replies[promisedKey]
      if (reply) {
        assert(reply instanceof Continuation)
        if (!reply.isPromise()) {
          const { type, payload } = reply
          const [height, index] = Channel.#splitKey(promisedKey)
          return RxReply.create(type, payload, this.address, height, index)
        }
      }
    }
  }

  #nextCoords() {
    // TODO move out to utils file
    let nextHeight = Number.isInteger(this.tipHeight) ? this.tipHeight + 1 : 1
    let nextIndex = 0
    if (typeof rxRepliesTip === 'string') {
      const [height, index] = Channel.#splitKey(this.rxRepliesTip)
      assert(height <= nextHeight)
      if (height === nextHeight) {
        nextIndex = index + 1
      }
    }
    return [nextHeight, nextIndex]
  }
  #rxLoopbackContinuation() {
    if (Object.keys(this.replies).length) {
      const [nextHeight, nextIndex] = this.#nextCoords()
      // TODO assert no replies higher than this one are present
      const key = `${nextHeight}_${nextIndex}`
      if (this.replies[key]) {
        const action = this.replies[key]
        return [action, nextHeight, nextIndex]
      }
    }
    return []
  }
  rxLoopbackReply() {
    const [action, height, index] = this.#rxLoopbackContinuation()
    if (!action || action.type === '@@PROMISE') {
      return
    }
    const { type, payload } = action
    return RxReply.create(type, payload, this.address, height, index)
  }
  isLoopbackReplyPromised() {
    const [action] = this.#rxLoopbackContinuation()
    if (action && action.type === '@@PROMISE') {
      return true
    }
    return false
  }

  rxLoopbackRequest() {
    assert(this.isLoopback())
    const [nextHeight, nextIndex] = this.#nextCoords()
    if (this.requests[nextIndex]) {
      const { type: t, payload: p } = this.requests[nextIndex]
      return RxRequest.create(t, p, this.address, nextHeight, nextIndex)
    }
  }

  isLoopbackExhausted() {
    if (this.rxLoopbackSettle()) {
      return false
    }
    if (this.rxLoopbackReply()) {
      return false
    }
    if (this.isLoopbackReplyPromised()) {
      return false
    }
    if (this.rxLoopbackRequest()) {
      return false
    }
    return true
  }
  rxLoopback() {
    let rx
    rx = this.rxLoopbackSettle()
    if (rx) {
      return rx
    }
    rx = this.rxLoopbackReply()
    if (rx) {
      return rx
    }
    rx = this.rxLoopbackRequest()
    if (rx) {
      return rx
    }
  }
}
