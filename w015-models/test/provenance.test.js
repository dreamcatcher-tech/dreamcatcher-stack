const assert = require('assert')
const {
  keypairModel,
  integrityModel,
  dmzModel,
  provenanceModel,
} = require('../index')
require('../../w012-crypto').testMode()

describe('provenance', () => {
  test('creates default model', async () => {
    const provenance = await provenanceModel.create()
    assert(provenance)
    const json = provenance.serialize()
    assert(typeof json === 'string')
    const clone = provenanceModel.clone(json)
    assert(clone)
    assert(typeof clone.getAddress === 'function')
  })
  test('checks own integrity', async () => {
    const provenance = await provenanceModel.create()
    const clone = provenanceModel.clone(provenance.serialize())
    const degraded = {
      ...clone,
      integrity: integrityModel.create({ test: 'test' }),
    }
    assert(provenanceModel.clone(clone))
    assert.throws(() => provenanceModel.clone(degraded))
  })
  test('randomness inside genesis', async () => {
    const dmz = dmzModel.create()
    const g1 = await provenanceModel.create(dmz)
    const g2 = await provenanceModel.create(dmz)
    assert(g1 !== g2)
  })
  test('genesis address is stable', async () => {
    const g = await provenanceModel.create()
    const a1 = g.getAddress()
    const a2 = g.getAddress()
    assert(a1 === a2)
  })
  test('reflects own integrity', async () => {
    const prov = await provenanceModel.create()
    const ref = prov.reflectIntegrity()
    const pure = integrityModel.create(prov)
    assert(pure === ref)
  })
  test('lineage checks', async () => {
    const dmz = dmzModel.create()
    const parent = await provenanceModel.create(dmz)
    assert.equal(Object.keys(parent.lineage).length, 0)
    const child = await provenanceModel.create(dmz, parent)
    const [parentIntegrity, ...other] = Object.values(child.lineage)

    assert(!other.length)
    assert(parentIntegrity)
    assert(parentIntegrity.hash === parent.reflectIntegrity().hash)
    assert(child.height === parent.height + 1)
    assert(child.getAddress() === parent.getAddress())
    assert(parent.isNext(child))
  })
  test.todo('non genesis lineage always has at least one hash')
  test.todo('isNext checks height and lineage')
  test.todo('genesis address must have height 0')
  test.todo('check signature integrity and order')
  test.todo('dmzIntegrity must be at least genuine')
  test.todo('merge multiple provenences into one')
  test.todo('height is zero iff address is genesis')
  describe('multi parent merge', () => {
    test.todo('only one genesis block allowed')
    test.todo('no duplicate parents')
  })
})
