import { IpldStruct } from './IpldStruct'
import { Interpulse, Address, Provenance, PublicKey, Dmz, Network } from '.'
import assert from 'assert-fast'
import { fromString as from } from 'uint8arrays/from-string'
/**
 type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
 */
export class Pulse extends IpldStruct {
  static classMap = { provenance: Provenance }
  static createCI = () => {
    const network = Network.createRoot()
    const dmz = Dmz.create({ network })
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
  isRoot() {
    return this.provenance.dmz.network.parent.getAddress().isRoot()
  }
  addSignature(publicKey, signature) {
    assert(publicKey instanceof PublicKey)
    assert(isFormatCorrect(signature), `unparseable signature: ${signature}`)
    assert(this.provenance.validators.has(publicKey))
    // TODO check the signature is actually valid ?
    const index = this.provenance.validators.indexOf(publicKey)
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
      assert(this.provenance.validators.publicKeys.length)
      return true
    }
    const signatureCount = this.signatures.filter((s) => !!s).length
    return signatureCount >= this.provenance.validators.quorumThreshold
  }
  generateSoftPulse(parentAddress) {
    assert(!this.isModified())
    assert.strictEqual(this.currentCrush, this)
    // blank the parent transmissions
    let next = this
    if (this.isGenesis()) {
      // if this is the second pulse in the train, set the address
      const address = Address.generate(this)
      next = next.setMap({ provenance: { address } })
      if (!this.isRoot()) {
        assert(parentAddress instanceof Address)
        assert(parentAddress.isRemote())
        const network = next.provenance.dmz.network.setParent(parentAddress)
        next = next.setMap({ provenance: { dmz: { network } } })
      }
    } else {
      const provenance = next.provenance.setLineage(next)
      next = next.setMap({ provenance })
    }
    if (next.tranmissions) {
      const provenance = next.provenance.delete('transmissions')
      next = next.setMap({ provenance })
    }
    const channels = next.provenance.dmz.network.channels.blankTxs()
    return next.setMap({ provenance: { dmz: { network: { channels } } } })
  }
  async ingestInterpulse(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { target } = interpulse
    assert(this.getAddress().equals(target))
    let { network } = this.provenance.dmz
    network = await network.ingestInterpulse(interpulse)
    return this.setMap({ provenance: { dmz: { network } } })
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
