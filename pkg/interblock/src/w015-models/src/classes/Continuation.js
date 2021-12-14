import assert from 'assert-fast'
import { serializeError } from 'serialize-error'
import { continuationSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'
export class Continuation extends mixin(continuationSchema) {
  static create(type = '@@RESOLVE', payload = {}) {
    if (type === '@@REJECT' && payload instanceof Error) {
      payload = serializeError(payload)
    }
    return super.create({ type, payload })
  }
  assertLogic() {
    if (this.type === '@@PROMISE') {
      assert.strictEqual(
        Object.keys(this.payload).length,
        0,
        `Promises cannot have payloads`
      )
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
