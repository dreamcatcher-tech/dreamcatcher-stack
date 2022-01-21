import assert from 'assert-fast'
import { Dmz, Integrity, Address } from '.'
import { provenanceSchema } from '../schemas/modelSchemas'
import { Base, mixin } from '../MapFactory'
import Debug from 'debug'
import Immutable from 'immutable'
const debug = Debug('interblock:classes:Provenance')

export class Provenance extends mixin(provenanceSchema) {
  #address
  #reflectedIntegrity
  #lineageKeys
  #getLineageKeys() {
    if (!this.#lineageKeys) {
      this.#lineageKeys = Immutable.List()
      for (const [key] of this.lineage.entries()) {
        this.#lineageKeys = this.#lineageKeys.push(parseInt(key))
      }
    }
    return this.#lineageKeys
  }
  static create(dmz = Dmz.create(), forkedLineage = {}) {
    assert(dmz instanceof Dmz)
    assert(dmz.hashString(), 'Dmz must be ready for hashing')
    assert.strictEqual(typeof forkedLineage, 'object')
    const dmzIntegrity = Integrity.create(dmz)
    assert.strictEqual(dmzIntegrity.hash, dmz.hashString())
    const provenance = {
      dmzIntegrity,
      height: 0,
      address: Address.create('GENESIS'),
      lineage: forkedLineage,
    }
    const integrity = Provenance.generateIntegrity(provenance)
    const signatures = []

    return super.create({ ...provenance, integrity, signatures })
  }
  static clone(obj) {
    return super.create(obj)
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
      assert(lineageKeys.size)
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
        (signature) => signature.integrity.deepEquals(this.integrity)
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
      this.#reflectedIntegrity = Provenance.generateIntegrity(this)
    }
    return this.#reflectedIntegrity
  }
  isNextProvenance(child) {
    assert(child instanceof Provenance)
    const parentLineage = child.lineage.get(this.height + '')
    const isParent =
      parentLineage && parentLineage.deepEquals(this.reflectIntegrity())
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
  hash() {
    throw new Error('do not hash provenance')
  }
  hashString() {
    this.hash()
  }
  static generateIntegrity(obj) {
    const checkKeys = ['dmzIntegrity', 'height', 'address', 'lineage']
    const check = {}
    for (const key of checkKeys) {
      assert(typeof obj[key] !== undefined, `missing integrity key: ${key}`)
      check[key] = obj[key]
    }
    check.dmzIntegrity = check.dmzIntegrity.hashString()
    check.address = check.address.hashString()
    if (obj.lineage instanceof Base) {
      check.lineage = {}
      for (const [key, value] of obj.lineage.entries()) {
        check.lineage[key] = value
      }
    } else {
      // in provenanceProducer, we cannot make a map, so used a plain object
      check.lineage = { ...obj.lineage }
    }
    for (const key of Object.keys(check.lineage)) {
      check.lineage[key] = check.lineage[key].hashString()
    }
    assert(!check.height || Object.keys(check.lineage).length)
    const integrity = Integrity.create(check)
    return integrity
  }
}
