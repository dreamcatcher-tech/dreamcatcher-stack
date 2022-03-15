import { assert } from 'chai/index.mjs'
import { Hamt } from '../../src/ipld/Hamt'
import Debug from 'debug'
const debug = Debug('interblock:tests:ipld:hamt')
Debug.enable('*hamt')

describe.only('Hamt', () => {
  test('basic', async () => {
    const base = Hamt.create()
    let hamt = base.set('testkey', 'testvalue')
    assert(base !== hamt)
    assert.strictEqual(hamt.get('testkey'), 'testvalue')
    assert(hamt.isModified())
    const crushed = await hamt.crush()
    debug(crushed.cid)
    const diffs = crushed.getDiffBlocks()
    debug(`diffs length:`, diffs.size)
    assert.strictEqual(diffs.size, 1)
    const resolver = (cid) => diffs.get(cid)
    const uncrushed = await Hamt.uncrush(crushed.cid, resolver)
    const ensured = await uncrushed.ensure(['testkey'])
    const result = ensured.get('testkey')
    assert.strictEqual(result, 'testvalue')
  })
  test.only('ensure', async () => {
    let hamt = Hamt.create()
    hamt = await hamt.crush()
    const diffs = hamt.getDiffBlocks()
    assert.strictEqual(diffs.size, 1)

    const resolver = (cid) => diffs.get(cid)
    hamt = await Hamt.uncrush(hamt.cid, resolver)
    for (let i = 0; i < 100; i++) {
      hamt = hamt.set('test-' + i, { test: 'test-' + i })
    }
    hamt = await hamt.crush()
    const bigDiffs = hamt.getDiffBlocks()
    debug(bigDiffs)
    const bigResolver = (cid) => bigDiffs.get(cid)

    hamt = await Hamt.uncrush(hamt.cid, bigResolver)
    hamt = await hamt.ensure(['test-59'])
    debug(hamt.get('test-59'))
    assert.deepEqual(hamt.get('test-59'), { test: 'test-59' })
  })
  test.todo('with class')
  test.todo('stress test')
})
