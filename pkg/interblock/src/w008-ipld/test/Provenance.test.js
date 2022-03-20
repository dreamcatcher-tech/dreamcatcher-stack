import { assert } from 'chai/index.mjs'
import Debug from 'debug'
import { Provenance, Dmz } from '../../src/ipld'
Debug.enable()

describe('provenance', () => {
  test('basic', async () => {
    const dmz = await Dmz.create().crush()
    let provenance = Provenance.createGenesis(dmz)
    provenance = await provenance.crush()
    const diffs = await provenance.getDiffBlocks()
    assert.strictEqual(diffs.size, 10)
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
