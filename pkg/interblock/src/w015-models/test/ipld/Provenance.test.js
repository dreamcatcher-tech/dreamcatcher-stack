import { assert } from 'chai/index.mjs'
import Debug from 'debug'
import { Provenance, Dmz } from '../../src/ipld'
Debug.enable()

describe('provenance', () => {
  test.only('creates default model', () => {
    const dmz = Dmz.create()
    const provenance = Provenance.create(dmz)
    assert(provenance)
    const array = provenance.toArray()
    const restore = Provenance.restore(array)
    assert(restore)
    assert(typeof restore.getAddress === 'function')
  })
  test('checks own integrity', () => {
    const provenance = Provenance.create()
    const arr = provenance.toArray()
    const degraded = [...arr]
    degraded[3] = Integrity.create({ test: 'test' }).toArray()
    assert(Provenance.restore(arr))
    assert.throws(() => Provenance.restore(degraded))
  })
  test('randomness inside genesis', () => {
    const dmz = Dmz.create()
    const g1 = Provenance.create(dmz)
    const g2 = Provenance.create(dmz)
    assert(!g1.deepEquals(g2))
  })
  test('genesis address is stable', async () => {
    const g = Provenance.create()
    const a1 = g.getAddress()
    const a2 = g.getAddress()
    assert(a1.deepEquals(a2))
    assert.strictEqual(a1, a2)
  })
  test('cannot fork from the future', () => {
    const dmz = Dmz.create()
    const parent = Provenance.create(dmz)
    assert.strictEqual(Object.keys(parent.lineage).length, 0)
    const parentHash = parent.reflectIntegrity()
    const forkedLineage = { 0: parentHash }
    const inheritFromFuture = () => Provenance.create(dmz, forkedLineage)
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
