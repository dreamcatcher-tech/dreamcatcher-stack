const assert = require('assert')
const _ = require('lodash')
const debug = require('debug')('interblock:models:provenance')
const { standardize } = require('../utils')
const { integrityModel } = require('./integrityModel')
const { keypairModel } = require('./keypairModel')
const { addressModel } = require('./addressModel')
const { provenanceSchema } = require('../schemas/modelSchemas')

const ciSigner = async (integrity) => {
  const ciKeypair = await keypairModel.create('CI')
  assert(integrityModel.isModel(integrity))
  return ciKeypair.sign(integrity)
}

const provenanceModel = standardize({
  schema: provenanceSchema,
  async create(
    dmz,
    parentProvenance,
    extraLineages = {},
    asyncSigner = ciSigner
  ) {
    const { dmzModel } = require('./dmzModel') // avoid circular reference
    dmz = dmz || dmzModel.create()
    assert(dmzModel.isModel(dmz))
    assert(!parentProvenance || provenanceModel.isModel(parentProvenance))
    assert.strictEqual(typeof extraLineages, 'object')
    assert(Object.values(extraLineages).every(integrityModel.isModel))
    assert(!Object.keys(extraLineages).length || parentProvenance)

    const template = integrityModel.create()
    dmzIntegrity = integrityModel.clone({
      ...template,
      hash: dmz.getHash(),
    })

    let address = addressModel.create('GENESIS')
    let height = 0
    const parentIntegrities = { ...extraLineages }
    if (parentProvenance) {
      const parentIntegrity = parentProvenance.reflectIntegrity()
      assert(
        !Object.values(parentIntegrities).some((integrity) =>
          integrity.equals(parentIntegrity)
        )
      )
      parentIntegrities[parentProvenance.height] = parentIntegrity
      height = parentProvenance.height + 1
      address = parentProvenance.getAddress()
    }
    const provenance = {
      dmzIntegrity,
      address,
      lineage: parentIntegrities,
      height,
    }
    const integrity = integrityModel.create(provenance)
    const signature = await asyncSigner(integrity)
    const signatures = [signature]
    return provenanceModel.clone({ ...provenance, integrity, signatures })
  },
  logicize(instance) {
    if (instance.dmzIntegrity.isUnknown()) {
      throw new Error(
        `Dmz not a genuine type of integrity: ${instance.dmzIntegrity.hash}`
      )
    }
    const lineageKeys = Object.keys(instance.lineage).map((i) => parseInt(i))
    assert(lineageKeys.length || instance.address.isGenesis())
    assert(instance.height || instance.address.isGenesis())
    // later, will allow foreign chains as prefixes to the provenance index
    assert(lineageKeys.every((i) => i >= 0 && i < instance.height))
    assert.strictEqual(instance.signatures.length, 1, `single signer only`)

    const selfIntegrity = () => {
      const check = _.omit(instance, ['integrity', 'signatures'])
      const integrity = integrityModel.create(check)
      const selfIntegrity = integrity.equals(instance.integrity)
      return selfIntegrity
    }
    const signatureIntegrity = () =>
      instance.signatures.length &&
      instance.signatures.every(
        (signature) => signature.integrity.equals(instance.integrity)
        // TODO check order the signatures is alphabetical / stable
      )

    if (!selfIntegrity()) {
      throw new Error('Self integrity degraded - refusing to instantiate')
    }
    if (!signatureIntegrity()) {
      throw new Error('Signature degraded - refusing to instantiate')
    }

    const reflectedIntegrity = integrityModel.create(instance)
    let { address } = instance
    if (instance.height === 0) {
      assert(address.isGenesis())
      address = addressModel.create(reflectedIntegrity)
    }
    const merge = (...args) => {
      // merge many models into one
      // check their integrity matches
      // blend the signatures into an array
    }
    const getAddress = () => address

    const reflectIntegrity = () => reflectedIntegrity
    const isNext = (child) => {
      const isParent = Object.values(child.lineage).some((lineage) =>
        lineage.equals(reflectIntegrity())
      )
      // TODO check signatures match ?
      const isHigher = child.height > instance.height
      const childPubkey = child.signatures[0].publicKey
      // const isSigned = childPubkey.equals( instance.signatures[0].publicKey )
      // TODO cannot determine isSigned without the dmz, since config changes
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
      merge,
      getAddress,
      reflectIntegrity,
      isNext,
      getShortestHeight,
    }
  },
})

module.exports = { provenanceModel }
