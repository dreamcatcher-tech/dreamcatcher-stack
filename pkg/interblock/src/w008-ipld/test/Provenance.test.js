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
    const diffs = provenance.getDiffBlocks()
    const cids = [...diffs.keys()]
    expect(cids).toMatchSnapshot()
    const values = [...diffs.values()].map((b) => b.value)
    expect(values).toMatchSnapshot()
  })
  test.todo('non genesis lineage always has at least one hash')
  describe('multi parent merge', () => {
    test.todo('only one ultimate genesis block allowed')
    test.todo('no duplicate parents')
  })
})
