import assert from 'assert-fast'
import { Network, Channel, Address, RxQueue, Request, Reply } from '.'

export class Loopback extends Channel {
  static create() {
    const address = Address.createLoopback()
    const loopback = super.create(Network.FIXED_IDS.LOOPBACK, address)
    assert(loopback instanceof Loopback)
    return loopback
  }
  // TODO reject any attempts to alias loopback
  txGenesis() {
    throw new Error('Loopback cannot birth children')
  }
}
