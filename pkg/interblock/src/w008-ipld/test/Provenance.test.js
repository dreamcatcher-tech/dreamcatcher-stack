import { assert } from 'chai/index.mjs'
import Debug from 'debug'
import { Provenance, Dmz } from '..'
import { Timestamp } from '../src'
Debug.enable()

describe('provenance', () => {
  test('basic', async () => {
    const now = new Date('2022-03-25T03:21:34.127Z')
    const timestamp = Timestamp.create(now)
    const dmz = await Dmz.create({ timestamp }).crush()
    let provenance = Provenance.createGenesis(dmz)
    provenance = await provenance.crush()
    const diffs = await provenance.getDiffBlocks()
    expect(diffs).toMatchSnapshot()
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
