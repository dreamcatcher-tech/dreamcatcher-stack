import assert from 'assert-fast'
import { standardize } from '../../modelUtils'
import { provenanceSchema } from '../../schemas/modelSchemas'
import { integrityModel } from '..'
import { addressModel } from '..'
import { dmzModel } from '..'
import Debug from 'debug'
const debug = Debug('interblock:models:provenance')

const provenanceModel = standardize({
  schema: provenanceSchema,
  create(dmz, forkedLineage = {}) {
    // throw new Error('Only provenanceProducer can create provenance types')
    dmz = dmz || dmzModel.create()
    assert(dmzModel.isModel(dmz))
    assert.strictEqual(typeof forkedLineage, 'object')
    const dmzIntegrity = integrityModel.create(dmz.getHash())
    const provenance = {
      dmzIntegrity,
      height: 0,
      address: addressModel.create('GENESIS'),
      lineage: forkedLineage,
    }
    const integrity = integrityModel.create(provenance)
    const signatures = []

    return provenanceModel.clone({ ...provenance, integrity, signatures })
  },
  logicize(instance) {
    const { signatures } = instance
    if (instance.dmzIntegrity.isUnknown()) {
      throw new Error(`Dmz integrity unknown: ${instance.dmzIntegrity.hash}`)
    }
    const lineageKeys = Object.keys(instance.lineage).map((i) => parseInt(i))
    // later, will allow foreign chains as prefixes to the provenance index
    assert(lineageKeys.every((i) => i >= 0 && i < instance.height))
    if (instance.height === 0) {
      assert(instance.address.isGenesis())
    } else {
      assert(instance.signatures.length <= 1, `single signer only`)
      assert(lineageKeys.length)
    }

    const _selfIntegrity = () => {
      const check = {}
      // TODO remove order of keys being important
      const checkKeys = ['dmzIntegrity', 'height', 'address', 'lineage']
      checkKeys.forEach((key) => (check[key] = instance[key]))
      const integrity = integrityModel.create(check)
      const selfIntegrity = integrity.equals(instance.integrity)
      return selfIntegrity
    }
    const _signatureIntegrity = () => {
      if (instance.address.isGenesis()) {
        return signatures.length === 0
      }
      return signatures.every(
        (signature) => signature.integrity.equals(instance.integrity)
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
    const reflectedIntegrity = integrityModel.create(instance)
    let { address } = instance
    if (instance.height === 0) {
      assert(address.isGenesis())
      address = addressModel.create(reflectedIntegrity)
    }
    const getAddress = () => address
    // TODO generate reflectedIntegrity and address lazily
    const reflectIntegrity = () => reflectedIntegrity
    const isNextProvenance = (child) => {
      const isParent = Object.values(child.lineage).some((lineage) =>
        lineage.equals(reflectIntegrity())
      )
      const isHigher = child.height > instance.height
      return isParent && isHigher
    }
    const getShortestHeight = () => {
      const ints = [...lineageKeys]
      ints.sort((a, b) => a - b)
      const shortest = ints.shift()
      assert(shortest >= 0 && shortest < instance.height)
      return shortest
    }
    return {
      getAddress,
      reflectIntegrity,
      isNextProvenance,
      getShortestHeight,
    }
  },
})

export { provenanceModel }
