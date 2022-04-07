import { IpldStruct } from './IpldStruct'
import { Address, Provenance } from '.'
import assert from 'assert-fast'

export class Pulse extends IpldStruct {
  static create(provenance = Provenance.createGenesis()) {
    assert(provenance instanceof Provenance)
    const instance = super.clone({ provenance, signatures: [] })
    return instance
  }
  addSignature(index, signature) {
    // validate signature
  }
  getAddress() {
    if (this.provenance.address.isGenesis()) {
      return Address.generate(this)
    }
    return this.provenance.address
  }
  isVerifiedBlock() {
    if (this.provenance.address.isGenesis()) {
      return true
    }
    const sigCheck = checkSignatures(this.validators, this.provenance)
    const { isPierce, isAllRequired, isOnlyRequired } = sigCheck
    return isPierce || (isAllRequired && isOnlyRequired)
  }
}
