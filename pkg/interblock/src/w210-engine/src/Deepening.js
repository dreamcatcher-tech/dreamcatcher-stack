import assert from 'assert-fast'
import { Address, Pulse, Request } from '../../w008-ipld'
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

  static createInterpulse(target, pulse) {
    assert(target instanceof Address)
    assert(pulse instanceof Pulse)
    const instance = new Deepening(target)
    instance.type = Deepening.INTERPULSE
    instance.payload = { pulse }
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
  static createUpdate(target, pulse) {
    assert(target instanceof Address)
    assert(pulse instanceof Pulse)
    const instance = new Deepening(target)
    instance.type = Deepening.UPDATE
    instance.payload = { pulse }
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
