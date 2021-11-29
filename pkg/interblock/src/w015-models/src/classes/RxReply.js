import assert from 'assert-fast'
import { rxReplySchema } from '../schemas/transientSchemas'
import { mixin } from './MapFactory'
import { splitSequence } from '../transients/splitSequence'

export class RxReply extends mixin(rxReplySchema) {
  static create(type = '@@RESOLVE', payload = {}, address, height, index) {
    let identifier
    if (typeof address === 'string') {
      identifier = address
    } else {
      identifier = `${address.getChainId()}_${height}_${index}`
    }
    const rxReply = { type, payload, identifier }
    return super.create(rxReply)
  }
  assertLogic() {
    // TODO reuse the same checks in rxRequest ??
    const { address, height, index } = splitSequence(this.identifier)
    assert(!address.isUnknown())
    assert(Number.isInteger(height))
    assert(height >= 0)
    assert(Number.isInteger(index))
    assert(index >= 0)
  }
  isReply() {
    return true
  }
  getAddress() {
    // TODO move all usage to be properties directly
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
  getLogEntry() {
    const { type, address } = this
    const chainId = address.getChainId()
    return `${type} ${chainId.substring(0, 9)} ${this.getReplyKey()}`
  }
}
