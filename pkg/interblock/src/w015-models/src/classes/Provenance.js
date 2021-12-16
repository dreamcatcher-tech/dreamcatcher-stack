import assert from 'assert-fast'
import { Dmz, Integrity, Address } from '.'
import { provenanceSchema } from '../schemas/modelSchemas'
import { mixin } from '../MapFactory'
import Debug from 'debug'
const debug = Debug('interblock:classes:Provenance')

export class Provenance extends mixin(provenanceSchema) {
  #address
  #reflectedIntegrity
  #lineageKeys
  #getLineageKeys() {
    if (!this.#lineageKeys) {
      this.#lineageKeys = Object.keys(this.lineage).map((i) => parseInt(i))
    }
    return this.#lineageKeys
  }
  static create(dmz = Dmz.create(), forkedLineage = {}) {
    assert(dmz instanceof Dmz)
    assert(dmz.hashString(), 'Dmz must be ready for hashing')
    assert.strictEqual(typeof forkedLineage, 'object')
    const dmzIntegrity = Integrity.create(dmz)
    const provenance = {
      dmzIntegrity,
      height: 0,
      address: Address.create('GENESIS'),
      lineage: forkedLineage,
    }
    const integrity = generateIntegrity(provenance)
    const signatures = []

    return super.create({ ...provenance, integrity, signatures })
  }
  assertLogic() {
    const { signatures } = this
    if (this.dmzIntegrity.isUnknown()) {
      throw new Error(`Dmz integrity unknown: ${this.dmzIntegrity.hash}`)
    }
    // later, will allow foreign chains as prefixes to the provenance index
    const lineageKeys = this.#getLineageKeys()
    const notFuture = lineageKeys.every((i) => i >= 0 && i < this.height)
    assert(notFuture, `fork is from the future`)
    if (this.height === 0) {
      assert(this.address.isGenesis())
    } else {
      assert(this.signatures.length <= 1, `single signer only`)
      assert(lineageKeys.length)
    }
    const reflectedIntegrity = this.reflectIntegrity()
    if (!this.integrity.deepEquals(reflectedIntegrity)) {
      throw new Error('Self integrity degraded - refusing to instantiate')
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
    if (!_signatureIntegrity()) {
      _signatureIntegrity()
      throw new Error('Signature degraded - refusing to instantiate')
    }
  }
  getAddress() {
    if (!this.#address) {
      this.#address = this.address
      if (this.height === 0) {
        this.#address = Address.create(this.reflectIntegrity())
      }
    }
    return this.#address
  }
  // TODO generate reflectedIntegrity and address lazily
  reflectIntegrity() {
    if (!this.#reflectedIntegrity) {
      this.#reflectedIntegrity = generateIntegrity(this)
    }
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
    const ints = [...this.#getLineageKeys()]
    ints.sort((a, b) => a - b)
    const shortest = ints.shift()
    assert(shortest >= 0 && shortest < this.height)
    return shortest
  }
}

const generateIntegrity = (obj) => {
  const checkKeys = ['dmzIntegrity', 'height', 'address', 'lineage']
  const check = {}
  for (const key of checkKeys) {
    check[key] = obj[key]
  }
  check.dmzIntegrity = check.dmzIntegrity.hashString()
  check.address = check.address.hashString()
  check.lineage = { ...check.lineage }
  for (const key of Object.keys(check.lineage)) {
    check.lineage[key] = check.lineage[key].hashString()
  }
  const integrity = Integrity.create(check)
  return integrity
}
