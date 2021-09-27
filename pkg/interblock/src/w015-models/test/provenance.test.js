import { assert } from 'chai/index.mjs'
import { integrityModel, dmzModel, provenanceModel } from '../index'

describe('provenance', () => {
  test('creates default model', () => {
    const provenance = provenanceModel.create()
    assert(provenance)
    const json = provenance.serialize()
    assert(typeof json === 'string')
    const clone = provenanceModel.clone(json)
    assert(clone)
    assert(typeof clone.getAddress === 'function')
  })
  test('checks own integrity', () => {
    const provenance = provenanceModel.create()
    const clone = provenanceModel.clone(provenance.serialize())
    const degraded = {
      ...clone,
      integrity: integrityModel.create({ test: 'test' }),
    }
    assert(provenanceModel.clone(clone))
    assert.throws(() => provenanceModel.clone(degraded))
  })
  test('randomness inside genesis', () => {
    const dmz = dmzModel.create()
    const g1 = provenanceModel.create(dmz)
    const g2 = provenanceModel.create(dmz)
    assert(!g1.equals(g2))
  })
  test('genesis address is stable', async () => {
    const g = provenanceModel.create()
    const a1 = g.getAddress()
    const a2 = g.getAddress()
    assert(a1.equals(a2))
  })
  test('reflects own integrity', () => {
    const prov = provenanceModel.create()
    const ref = prov.reflectIntegrity()
    const pure = integrityModel.create(prov)
    assert(pure.equals(ref))
  })
  test('cannot fork from the future', () => {
    const dmz = dmzModel.create()
    const parent = provenanceModel.create(dmz)
    assert.strictEqual(Object.keys(parent.lineage).length, 0)
    const parentHash = parent.reflectIntegrity()
    const forkedLineage = { 0: parentHash }

    const inheritFromFuture = () => provenanceModel.create(dmz, forkedLineage)
    assert.throws(inheritFromFuture)
  })
  test.todo('remove chainId as part of lineage')
  test.todo('non genesis lineage always has at least one hash')
  test.todo('isNext checks height and lineage')
  test.todo('merge multiple provenences into one')
  test.todo('height is zero iff address is genesis')
  test.todo('genesis has no signatures')
  describe('multi parent merge', () => {
    test.todo('only one genesis block allowed')
    test.todo('no duplicate parents')
  })
})
