const assert = require('assert')
const {
  channelModel,
  networkModel,
  integrityModel,
  covenantIdModel,
  addressModel,
  provenanceModel,
  signatureModel,
} = require('..')
require('../../w012-crypto').testMode()

describe('standard model', () => {
  test('isModel', () => {
    assert(!covenantIdModel.isModel())
    assert(!covenantIdModel.isModel('not a model'))
    assert(!covenantIdModel.isModel({ still: 'not a model' }))

    const is = covenantIdModel.create()
    assert(covenantIdModel.isModel(is))
    const json = is.serialize()
    assert(!covenantIdModel.isModel(json))
    const reinflate = JSON.parse(json)
    assert(!covenantIdModel.isModel(reinflate))
    const clone = covenantIdModel.clone(reinflate)
    assert(covenantIdModel.isModel(clone))
  })
  test('equals works after serialize', () => {
    const integrity = integrityModel.create({ test: 'test' })
    const json = integrity.serialize()
    assert.equal(typeof json, 'string')
    const reflated = integrityModel.clone(json)
    const clone = integrityModel.clone(reflated)
    assert(clone.equals(integrity))
    assert(reflated.equals(integrity))
  })
  test('equals works after serialize for nested types', () => {
    const id = covenantIdModel.create('test')
    const json = id.serialize()
    assert.equal(typeof json, 'string')
    const reflated = covenantIdModel.clone(json)
    const clone = covenantIdModel.clone(reflated)
    assert(clone.equals(id))
    assert(reflated.equals(id))
  })
  test('equals works after serialize for nested pattern types', () => {
    const address = addressModel.create()
    const integrity = address.chainId

    const raw = JSON.parse(address.serialize())

    const clone = addressModel.clone(raw)
    assert(!clone.equals(raw))
    assert(clone.equals(address))
    assert(clone.chainId.equals(integrity), 'integrity not reinflated')
  })
  test('objects are immutable', () => {
    const integrity = integrityModel.create({ test: 'test' })
    assert(integrity.hash)
    assert.throws(() => delete integrity.hash)
  })
  test('nested objects are inflated from clones', () => {
    const covenantId = covenantIdModel.create()
    assert(covenantId.isSystemCovenant())
    const deflated = JSON.parse(JSON.stringify(covenantId))
    const altered = { ...deflated, name: 'altered' }
    const clone = covenantIdModel.clone(deflated)
    assert(clone.integrity.isUnknown())
    const cloneAltered = covenantIdModel.clone(altered)
    assert(
      cloneAltered.integrity.isUnknown,
      'reinflation failed on child functions'
    )
    assert(
      cloneAltered.integrity.isUnknown(),
      'reinflation failed on child functions'
    )
  })
  test('pattern at top level', () => {
    const tx = channelModel.create()
    let network = networkModel.create()
    network = networkModel.clone(network, (draft) => {
      draft.testPattern = channelModel.create()
    })
    assert(network.testPattern.equals(tx))
    const clone = networkModel.clone(network.serialize())
    assert(clone.testPattern.equals(tx))
  })
  test('objects have no functions attached as enumerable properties', () => {
    const transmission = channelModel.create()
    assert(transmission.getRemote())
    for (const key in transmission) {
      if (key === 'getRemote') {
        assert.fail()
      }
    }
  })
  test('pattern objects are inflated', () => {
    // TODO move to channelModel test, as need a nested pattern property
    const tx = channelModel.create()
    let network = networkModel.create()
    network = networkModel.clone(network, (draft) => {
      draft.testPattern = channelModel.create()
    })
    assert(network.testPattern.equals(tx))
    const clone = networkModel.clone(network.serialize())
    assert(clone.testPattern.equals(tx))
  })
  test('array items are inflated', async () => {
    const undefinedDmz = undefined
    const provenance = await provenanceModel.create()
    const { signatures } = provenance
    assert(Array.isArray(signatures))
    assert.equal(signatures.length, 1)
    const json = JSON.stringify(provenance)
    const revived = provenanceModel.clone(json)
    assert.equal(revived, provenance)
    assert(revived.signatures.every(signatureModel.isModel))
  })
  test.todo('array items inside pattern properties are inflated')
  test.todo('isModel only returns true if the object is in the clone cache')
  test.todo('allows option elements, specifically validators in interblock')
  test('reject on schema fail', () => {
    assert.throws(() => covenantIdModel.clone({ type: 'NOTHING' }))
  })
  test('can make a model from an existing model', () => {
    const model = covenantIdModel.create()
    const modelClone = covenantIdModel.clone(model)
    assert(covenantIdModel.isModel(modelClone))
  })
  test.skip('no circular references in models', async () => {
    const madge = require('madge')
    const res = await madge(__dirname + '/../src/models', {
      excludeRegExp: [/\.\./],
    })
    const path = await res.image(__dirname + '/../models.svg')
    console.log(`wrote image to: ${path}`)
  })
  test.todo('check the version of the message format')
  test.todo('can always create default with no arguments')
  test.todo('clone handles dmz.state with loops')
  test.todo('optional properties which are missing are not inflated')
})
