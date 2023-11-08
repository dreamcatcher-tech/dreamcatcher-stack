import assert from 'assert-fast'
import {
  Address,
  Pulse,
  Request,
  Interpulse,
  Reply,
  RequestId,
} from '../../w008-ipld/index.mjs'
/**
 * Deepens the pool by one of three actions:
 * 1. Interpulse from a remote chain
 * 2. Pierce from the local system
 * 3. Update from one of this chains children
 */
export class Deepening {
  static INTERPULSE = 'INTERPULSE'
  static PIERCE = 'PIERCE'
  static UPDATE = 'UPDATE'
  static REPLY_PIERCE = 'REPLY_PIERCE'

  static createInterpulse(interpulse, source) {
    assert(interpulse instanceof Interpulse)
    assert(!source || source instanceof Pulse)
    const target = interpulse.getTargetAddress()
    const instance = new Deepening(target)
    instance.type = Deepening.INTERPULSE
    instance.payload = { interpulse, source }
    return instance
  }
  static createPierce(target, request, piercer) {
    assert(target instanceof Address)
    assert(request instanceof Request)
    assert.strictEqual(typeof piercer, 'object')
    assert.strictEqual(typeof piercer.resolve, 'function')
    assert.strictEqual(typeof piercer.reject, 'function')
    const instance = new Deepening(target)
    instance.type = Deepening.PIERCE
    instance.payload = { request, piercer }
    return instance
  }
  static createReplyPierce(target, reply, requestId) {
    assert(target instanceof Address)
    assert(reply instanceof Reply)
    assert(requestId instanceof RequestId)
    const instance = new Deepening(target)
    instance.type = Deepening.REPLY_PIERCE
    instance.payload = { reply, requestId }
    return instance
  }
  static createUpdate(target, source) {
    assert(target instanceof Address)
    assert(source instanceof Pulse)
    const instance = new Deepening(target)
    instance.type = Deepening.UPDATE
    instance.payload = { source }
    return instance
  }
  constructor(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    this.address = address
  }
  get chainId() {
    return this.address.getChainId()
  }
}
