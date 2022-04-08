import { IpldStruct } from './IpldStruct'
import { PulseLink, Address, Provenance, PublicKey, Validators, Dmz } from '.'
import assert from 'assert-fast'
import { fromString as from } from 'uint8arrays/from-string'
import equals from 'fast-deep-equal'
/**
 type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
 */
export class Pulse extends IpldStruct {
  static classMap = { provenance: Provenance }
  static createCI = () => {
    const validators = Validators.createCI()
    const dmz = Dmz.create({ validators })
    const provenance = Provenance.createGenesis(dmz)
    return Pulse.create(provenance)
  }
  static create(provenance) {
    assert(provenance instanceof Provenance)
    const instance = super.clone({ provenance, signatures: [] })
    return instance
  }
  isGenesis() {
    return this.provenance.address.isGenesis()
  }
  addSignature(publicKey, signature) {
    assert(publicKey instanceof PublicKey)
    assert(isFormatCorrect(signature), `unparseable signature: ${signature}`)
    assert(this.provenance.dmz.validators.has(publicKey))
    // TODO check the signature is actually valid ?
    const index = this.provenance.dmz.validators.indexOf(publicKey)
    assert(!this.signatures[index])
    const signatures = [...this.signatures]
    signatures[index] = signature
    return this.setMap({ signatures })
  }
  getAddress() {
    if (this.provenance.address.isGenesis()) {
      return Address.generate(this)
    }
    return this.provenance.address
  }
  isVerified() {
    if (this.isModified()) {
      return false
    }
    if (this.provenance.address.isGenesis()) {
      assert(this.provenance.dmz.validators.publicKeys.length)
      return true
    }
    const signatureCount = this.signatures.filter((s) => !!s).length
    return signatureCount >= this.provenance.dmz.validators.quorumThreshold
  }
  async crush(resolver) {
    if (this.currentCrush) {
      if (this.isGenesis()) {
        // if this is the second pulse in the train, set the address
        assert(this.currentCrush.isGenesis())
        const address = Address.generate(this.currentCrush)
        const next = this.setMap({ provenance: { address } })
        return await next.crush(resolver)
      } else if (!this.provenance.hasLineage(this.currentCrush)) {
        const provenance = this.provenance.setLineage(this.currentCrush)
        const next = this.setMap({ provenance })
        return await next.crush(resolver)
      }
    }
    return await super.crush(resolver)
  }
}

const isFormatCorrect = (signature) => {
  try {
    from(signature, 'base36upper')
    return true
  } catch (e) {
    return false
  }
}
