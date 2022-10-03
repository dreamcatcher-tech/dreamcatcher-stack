import assert from 'assert-fast'
import equals from 'fast-deep-equal'
import { serializeError, deserializeError } from 'serialize-error'
import { Request, Pulse } from '.'

export class Reply extends Request {
  static createPromise() {
    return Reply.create('@@PROMISE')
  }
  static createError(error) {
    assert(error instanceof Error)
    return Reply.create('@@REJECT', error)
  }
  static createResolve(payload, binary) {
    return this.create('@@RESOLVE', payload, binary)
  }
  static createPulse(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())
    const type = '@@RESOLVE'
    const payload = pulse
    return super.clone({ type, payload })
  }
  static create(type = '@@RESOLVE', payload = {}, binary) {
    if (type === '@@REJECT' && payload instanceof Error) {
      if (payload.name === 'AssertionError') {
        if (payload.actual === undefined) {
          payload.actual = null
        }
      }
      payload = serializeError(payload)
    } else {
      const cloned = JSON.parse(JSON.stringify(payload))
      assert(equals(payload, cloned), 'payload must be stringifiable')
    }
    const reply = { type, payload }
    if (binary) {
      reply.binary = binary
    }
    return super.clone(reply)
  }
  assertLogic() {
    if (this.type === '@@PROMISE') {
      assert.strictEqual(
        Object.keys(this.payload).length,
        0,
        `Promises cannot have payloads`
      )
      assert(!this.binary, `Promises cannot have binary attachments`)
    } else {
      assert.strictEqual(typeof this.payload, 'object')
    }
  }
  isPromise() {
    return this.type === '@@PROMISE'
  }
  isRejection() {
    return this.type === '@@REJECT'
  }
  isResolve() {
    return this.type === '@@RESOLVE'
  }
  getRejectionError() {
    assert(this.isRejection())
    return deserializeError(this.payload)
  }
  static isReplyType(type) {
    assert.strictEqual(typeof type, 'string')
    assert(type)
    return type === '@@RESOLVE' || type === '@@REJECT' || type === '@@PROMISE'
  }
}
