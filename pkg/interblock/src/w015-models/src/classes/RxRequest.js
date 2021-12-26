import assert from 'assert-fast'
import { splitSequence } from '../splitSequence'
import { Action } from '.'
import { rxRequestSchema } from '../schemas/transientSchemas'
import { mixin } from '../MapFactory'

export class RxRequest extends mixin(rxRequestSchema) {
  #request
  #address
  #height
  #index
  static create(type, payload, address, height, index) {
    // TODO make this creation args less like passing in an interblock directly
    const identifier = `${address.getChainId()}_${height}_${index}`
    const rxRequest = { type, payload, identifier }
    return super.create(rxRequest)
  }
  assertLogic() {
    this.#ensureInternals()
    const address = this.getAddress()
    const height = this.getHeight()
    const index = this.getIndex()
    assert(!address.isUnknown())
    assert(Number.isInteger(height))
    assert(height >= 0)
    assert(Number.isInteger(index))
    assert(index >= 0)
  }
  // TODO extend from RxReply
  #ensureInternals() {
    if (!this.#address) {
      const { identifier } = this
      const { address, height, index } = splitSequence(identifier)
      this.#address = address
      this.#height = height
      this.#index = index
    }
  }
  getAddress() {
    this.#ensureInternals()
    return this.#address
  }
  getHeight() {
    this.#ensureInternals()
    return this.#height
  }
  getIndex() {
    this.#ensureInternals()
    return this.#index
  }
  getReplyKey() {
    this.#ensureInternals()
    return `${this.#height}_${this.#index}`
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
    this.#ensureInternals()
    const { type } = this
    const chainId = this.#address.getChainId()
    return `${type} ${chainId.substring(0, 9)} ${this.getReplyKey()}`
  }
}
