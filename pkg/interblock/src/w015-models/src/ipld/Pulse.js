import { IpldStruct } from './IpldStruct'
import { Address, Provenance } from '.'
import assert from 'assert-fast'

export class Pulse extends IpldStruct {
  static create(provenance) {
    assert(provenance instanceof Provenance)
    const instance = super.clone({ provenance, signatures: [] })
    return instance
  }
  addSignature(index, signature) {
    // validate signature
  }
  getAddress() {
    if (this.provenance.genesis.isGenesis()) {
      return Address.generate(this)
    }
    return this.provenance.genesis
  }
}
