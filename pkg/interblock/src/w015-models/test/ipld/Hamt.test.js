import { assert } from 'chai/index.mjs'
import { IpldStruct } from '../../src/ipld/IpldStruct'
import { Hamt } from '../../src/ipld/Hamt'
import Debug from 'debug'
const debug = Debug('interblock:tests:ipld:hamt')
Debug.enable()

describe('Hamt', () => {
  test('basic', async () => {
    const base = Hamt.create()
    assert(base.isModified())
    let hamt = base.set('testkey', 'testvalue')
    assert(hamt.isModified())
    assert(base !== hamt)
    assert.strictEqual(hamt.get('testkey'), 'testvalue')
    const crushed = await hamt.crush()
    const diffs = await crushed.getDiffBlocks()
    assert.strictEqual(diffs.size, 1)
    const resolver = (cid) => diffs.get(cid).bytes
    const uncrushed = await Hamt.uncrush(crushed.cid, resolver)
    const ensured = await uncrushed.ensure(['testkey'], resolver)
    const result = ensured.get('testkey')
    assert.strictEqual(result, 'testvalue')
  })
  test('ensure', async () => {
    let hamt = Hamt.create()
    hamt = await hamt.crush()
    const diffs = await hamt.getDiffBlocks()
    assert.strictEqual(diffs.size, 1)

    const resolver = (cid) => diffs.get(cid).bytes
    hamt = await Hamt.uncrush(hamt.cid, resolver)
    for (let i = 0; i < 100; i++) {
      hamt = hamt.set('test-' + i, { test: 'test-' + i })
    }
    let start = Date.now()
    hamt = await hamt.crush()
    debug(`crush: ${Date.now() - start} ms`)
    start = Date.now()
    const bigDiffs = await hamt.getDiffBlocks()
    debug(`diffs: ${Date.now() - start} ms`)
    start = Date.now()
    const bigResolver = (cid) => bigDiffs.get(cid).bytes
    hamt = await Hamt.uncrush(hamt.cid, bigResolver)
    debug(`uncrush: ${Date.now() - start} ms`)
    start = Date.now()
    hamt = await hamt.ensure(['test-59'], bigResolver)
    debug(`ensure: ${Date.now() - start} ms`)

    debug(hamt.get('test-59'))
    assert.deepEqual(hamt.get('test-59'), { test: 'test-59' })
    assert.throws(() => hamt.get('test-58'))
    start = Date.now()
    hamt = await hamt.ensure(['test-58'], bigResolver)
    debug(`ensure: ${Date.now() - start} ms`)

    assert.deepEqual(hamt.get('test-58'), { test: 'test-58' })
  })
  test('with class', async () => {
    class TestClass extends IpldStruct {}
    let hamt = Hamt.create(TestClass)
    assert.throws(() => hamt.set('test', { a: 'b' }), 'Not correct class type')
    const testInstance = new TestClass()
    hamt = hamt.set('test', testInstance)
    assert(hamt.get('test') instanceof TestClass)
    hamt = await hamt.crush()
    const diffs = await hamt.getDiffBlocks()
    const resolver = (cid) => diffs.get(cid).bytes
    hamt = await Hamt.uncrush(hamt.cid, resolver, TestClass)
    hamt = await hamt.ensure(['test'], resolver)
    assert(hamt.get('test') instanceof TestClass)
  })
})
