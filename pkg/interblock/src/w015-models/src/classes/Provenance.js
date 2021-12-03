import assert from 'assert-fast'
import { Dmz, Integrity, Address } from '.'
import { provenanceSchema } from '../schemas/modelSchemas'
import { mixin } from './MapFactory'

export class Provenance extends mixin(provenanceSchema) {
  #address
  #reflectedIntegrity
  #lineageKeys
  static create(dmz = Dmz.create(), forkedLineage = {}) {
    assert(dmz instanceof Dmz)
    assert(dmz.hashString(), 'Dmz must be ready for hashing')
    assert.strictEqual(typeof forkedLineage, 'object')
    // TODO handle raw Uint8Array
    const dmzIntegrity = Integrity.create(dmz)
    const provenance = {
      dmzIntegrity,
      height: 0,
      address: Address.create('GENESIS'),
      lineage: forkedLineage,
    }
    const integrity = Integrity.create(provenance)
    const signatures = []

    return super.create({ ...provenance, integrity, signatures })
  }
  assertLogic() {
    const { signatures } = this
    if (this.dmzIntegrity.isUnknown()) {
      throw new Error(`Dmz integrity unknown: ${this.dmzIntegrity.hash}`)
    }
    this.#lineageKeys = Object.keys(this.lineage).map((i) => parseInt(i))
    // later, will allow foreign chains as prefixes to the provenance index
    const notFuture = this.#lineageKeys.every((i) => i >= 0 && i < this.height)
    assert(notFuture, `fork is from the future`)
    if (this.height === 0) {
      assert(this.address.isGenesis())
    } else {
      assert(this.signatures.length <= 1, `single signer only`)
      assert(this.#lineageKeys.length)
    }

    const _selfIntegrity = () => {
      const check = {}
      // TODO remove order of keys being important
      const checkKeys = ['dmzIntegrity', 'height', 'address', 'lineage']
      checkKeys.forEach((key) => (check[key] = this[key]))
      const integrity = Integrity.create(check)
      const selfIntegrity = integrity.equals(this.integrity)
      return selfIntegrity
    }
    const _signatureIntegrity = () => {
      if (this.address.isGenesis()) {
        return signatures.length === 0
      }
      return signatures.every(
        (signature) => signature.integrity.equals(this.integrity)
        // TODO check order the signatures is alphabetical / stable
      )
    }
    if (!_selfIntegrity()) {
      throw new Error('Self integrity degraded - refusing to instantiate')
    }
    if (!_signatureIntegrity()) {
      _signatureIntegrity()
      throw new Error('Signature degraded - refusing to instantiate')
    }
    this.#reflectedIntegrity = Integrity.create(this)
    this.#address = this.address
    if (this.height === 0) {
      assert(this.address.isGenesis())
      this.#address = Address.create(this.#reflectedIntegrity)
    }
  }
  getAddress() {
    return this.#address
  }
  // TODO generate reflectedIntegrity and address lazily
  reflectIntegrity() {
    return this.#reflectedIntegrity
  }
  isNextProvenance(child) {
    const isParent = Object.values(child.lineage).some((lineage) =>
      lineage.equals(this.reflectIntegrity())
    )
    const isHigher = child.height > this.height
    return isParent && isHigher
  }
  getShortestHeight() {
    const ints = [...this.#lineageKeys]
    ints.sort((a, b) => a - b)
    const shortest = ints.shift()
    assert(shortest >= 0 && shortest < this.height)
    return shortest
  }
}
