import assert from 'assert-fast'
import { txReplySchema } from '../schemas/transientSchemas'
import { splitSequence } from '../splitSequence'
import { mixin } from '../MapFactory'
import { Continuation } from '.'

export class TxReply extends mixin(txReplySchema) {
  #address
  #height
  #index
  #continuation
  static create(type = '@@RESOLVE', payload = {}, identifier) {
    const txReply = { type, payload, identifier }
    return super.create(txReply)
  }
  #ensurePrivates() {
    if (!this.#address) {
      const { address, height, index } = splitSequence(this.identifier)
      this.#address = address
      this.#height = height
      this.#index = index
    }
  }
  getAddress() {
    this.#ensurePrivates()
    return this.#address
  }
  getHeight() {
    this.#ensurePrivates()
    return this.#height
  }
  getIndex() {
    this.#ensurePrivates()
    return this.#index
  }
  getReplyKey() {
    this.#ensurePrivates()
    return `${this.#height}_${this.#index}`
  }

  getReply() {
    if (!this.#continuation) {
      this.#continuation = Continuation.create(this.type, this.payload)
    }
    return this.#continuation
  }
}
