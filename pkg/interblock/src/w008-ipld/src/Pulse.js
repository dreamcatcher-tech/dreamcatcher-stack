import { IpldStruct } from './IpldStruct'
import { Interpulse, Address, Provenance, PublicKey, Dmz, Network } from '.'
import assert from 'assert-fast'
import { fromString as from } from 'uint8arrays/from-string'
import { PulseLink } from './PulseLink'
/**
 type Pulse struct {
    provenance &Provenance
    signatures Signatures
}
 */
export class Pulse extends IpldStruct {
  static classMap = { provenance: Provenance }
  static async createCI() {
    const network = await Network.createRoot()
    const dmz = Dmz.create({ network })
    const provenance = Provenance.createGenesis(dmz)
    return await Pulse.create(provenance).crush()
  }
  static create(provenance) {
    assert(provenance instanceof Provenance)
    const instance = super.clone({ provenance, signatures: [] })
    return instance
  }
  isGenesis() {
    return this.provenance.address.isGenesis()
  }
  async isRoot() {
    const parent = await this.provenance.dmz.network.getParent()
    if (parent) {
      return parent.getAddress().isRoot()
    }
    return false
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
  async generateGenesisSoftPulse(parent) {
    assert(!this.isModified())
    assert.strictEqual(this.currentCrush, this)
    assert(this.isGenesis())
    assert(!this.provenance.transmissions)
    const isRoot = await this.isRoot()
    // blank the parent transmissions
    let next = this
    // if this is the second pulse in the train, set the address
    const address = Address.generate(this)
    next = next.setMap({ provenance: { address } })
    if (isRoot) {
      assert.strictEqual(parent, undefined)
    } else {
      assert(parent instanceof Pulse)
      assert(!parent.isGenesis())
      const parentAddress = parent.getAddress()
      assert(parentAddress.isRemote())
      let { network } = next.provenance.dmz
      network = await network.resolveParent(parentAddress)
      next = next.setMap({ provenance: { dmz: { network } } })
    }
    let provenance = next.provenance.setLineage(this)
    if (next.transmissions) {
      provenance = next.provenance.delete('transmissions')
    }
    const precedent = this.getPulseLink()
    const channels = await provenance.dmz.network.channels.blankTxs(precedent)
    provenance = provenance.setMap({ dmz: { network: { channels } } })
    return next.setMap({ provenance })
  }

  async generateSoftPulse() {
    assert(!this.isModified())
    assert.strictEqual(this.currentCrush, this)
    assert(!this.isGenesis())
    // blank the parent transmissions
    let next = this
    let provenance = next.provenance.setLineage(next)
    if (provenance.transmissions) {
      provenance = provenance.delete('transmissions')
    } else {
      assert.strictEqual(provenance.dmz.network.channels.txs.length, 0)
    }
    const precedent = this.getPulseLink()
    const channels = await provenance.dmz.network.channels.blankTxs(precedent)
    provenance = provenance.setMap({ dmz: { network: { channels } } })
    next = next.setMap({ provenance })
    return next
  }
  async ingestInterpulse(interpulse) {
    let next = this
    if (!this.isModified()) {
      next = await this.generateSoftPulse()
    }
    assert(interpulse instanceof Interpulse)
    const { target } = interpulse
    assert(next.getAddress().equals(target))
    let { network } = next.provenance.dmz
    network = await network.ingestInterpulse(interpulse)
    return next.setMap({ provenance: { dmz: { network } } })
  }
  getNetwork() {
    return this.provenance.dmz.network
  }
  setNetwork(network) {
    assert(network instanceof Network)
    return this.setMap({ provenance: { dmz: { network } } })
  }
  getPulseLink() {
    return PulseLink.generate(this)
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
