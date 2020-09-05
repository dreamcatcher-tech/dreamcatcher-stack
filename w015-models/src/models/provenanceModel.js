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
  async create(dmz, parent, lineageForks = {}, asyncSigner = ciSigner) {
    const { dmzModel } = require('./dmzModel') // avoid circular reference
    dmz = dmz || dmzModel.create()
    assert(dmzModel.isModel(dmz))
    assert(!parent || provenanceModel.isModel(parent))
    assert.equal(typeof lineageForks, 'object')
    assert(Object.values(lineageForks).every(integrityModel.isModel))

    const template = integrityModel.create()
    dmzIntegrity = integrityModel.clone({
      ...template,
      hash: dmz.getHash(),
    })

    let address = addressModel.create('GENESIS')
    let height = 0
    const parentIntegrities = { ...lineageForks }
    if (parent) {
      const parentIntegrity = parent.reflectIntegrity()
      assert(!Object.values(parentIntegrities).includes(parentIntegrity))
      parentIntegrities[parent.height] = parentIntegrity
      height = parent.height + 1
      address = parent.getAddress()
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
    const lineageKeys = Object.keys(instance.lineage)
    assert(lineageKeys.length || instance.address.isGenesis())
    assert(instance.height || instance.address.isGenesis())
    // later, will allow foreign chains as prefixes to the provenance index
    assert(lineageKeys.every((key) => parseInt(key) >= 0))
    assert.equal(instance.signatures.length, 1, `single signer in prototype`)

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
    let { address, height } = instance
    if (height === 0) {
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
      const isParent = Object.values(child.lineage).includes(reflectIntegrity())
      // TODO check signatures match ?
      const isHigher = child.height > instance.height
      const childPubkey = child.signatures[0].publicKey
      // const isSigned = childPubkey.equals( instance.signatures[0].publicKey )
      // TODO cannot determine isSigned without the dmz, since config changes
      return isParent && isHigher
    }
    const getShortestHeight = () => {
      const ints = lineageKeys.map(parseInt)
      ints.sort((a, b) => a - b)
      return ints.shift()
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
