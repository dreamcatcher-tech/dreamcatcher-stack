import assert from 'assert-fast'
import { splitSequence } from '../transients/splitSequence'
import { Action } from '.'
import { rxRequestSchema } from '../schemas/transientSchemas'
import { mixin } from './MapFactory'

export class RxRequest extends mixin(rxRequestSchema) {
  #request
  static create(type, payload, address, height, index) {
    // TODO make this creation args less like passing in an interblock directly
    const identifier = `${address.getChainId()}_${height}_${index}`
    const rxRequest = { type, payload, identifier }
    return super.create(rxRequest)
  }
  assertLogic() {
    const { type, payload, identifier } = this
    const { address, height, index } = splitSequence(identifier)
    assert(!address.isUnknown())
    assert(Number.isInteger(height))
    assert(height >= 0)
    assert(Number.isInteger(index))
    assert(index >= 0)
  }
  // TODO extend from RxReply
  getAddress() {
    return this.address
  }
  getHeight() {
    return this.height
  }
  getIndex() {
    return this.index
  }
  getReplyKey() {
    return `${this.height}_${this.index}`
  }
  getRequest() {
    if (!this.#request) {
      const { type, payload } = this
      this.#request = Action.create({ type, payload })
    }
    return this.#request
  }
  isReply() {
    return false
  }
  getLogEntry() {
    const { type, address } = this
    const chainId = address.getChainId()
    return `${type} ${chainId.substring(0, 9)} ${this.getReplyKey()}`
  }
}
