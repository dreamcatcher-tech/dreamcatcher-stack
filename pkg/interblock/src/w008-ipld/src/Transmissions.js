import { Address, Tx } from '.'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Transmissions extends IpldStruct {
  static defaultClass = Tx // TODO remove defaultClass and hoist this class
  static isCidLink() {
    return true
  }
  static create() {
    return new Transmissions()
  }
  addTx(address, tx) {
    assert(address instanceof Address)
    assert(tx instanceof Tx)
    assert(address.isRemote())
    const chainId = address.getChainId()
    return this.setMap({ [chainId]: tx })
  }
}
