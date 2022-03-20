import assert from 'assert-fast'
import equals from 'fast-deep-equal'
import { serializeError } from 'serialize-error'
import { Request } from '.'

export class Reply extends Request {
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
}
