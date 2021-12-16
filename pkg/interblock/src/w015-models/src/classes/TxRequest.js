import assert from 'assert-fast'
import posix from 'path-browserify'
import { txRequestSchema } from '../schemas/transientSchemas'
import { mixin } from '../MapFactory'
import { Action } from '.'

export class TxRequest extends mixin(txRequestSchema) {
  #request
  static create(type = 'DEFAULT_TX_REQUEST', payload = {}, to = '.') {
    to = posix.normalize(to)
    const txRequest = { type, payload, to }
    return super.create(txRequest)
  }
  assertLogic() {
    // TODO if to matches chainId regex length, ensure full match
    const { type, payload, to } = this
    const normalized = posix.normalize(to)
    assert.strictEqual(normalized, to, `"to" not normalized: ${to}`)
  }
  getRequest() {
    if (!this.#request) {
      const { type, payload } = this
      this.#request = Action.create({ type, payload })
    }
    return this.#request
  }
}
