import { IpldStruct } from '../src/IpldStruct'
import { assert } from 'chai/index.mjs'
import { Hamt } from '../src/Hamt'
import Debug from 'debug'

const debug = Debug('interblock:tests:ipld:hamt')

describe('Hamt', () => {
  test('basic', async () => {
    const base = Hamt.create()
    assert(base.isModified())
    let hamt = await base.set('testkey', 'testvalue')
    assert(hamt.isModified())
    assert(base !== hamt)
    assert.strictEqual(await hamt.get('testkey'), 'testvalue')
    const crushed = await hamt.crush()
    const diffs = crushed.getDiffBlocks()
    assert.strictEqual(diffs.size, 1)
    const resolver = (cid) => diffs.get(cid.toString())
    const uncrushed = await Hamt.uncrush(crushed.cid, resolver)
    assert(await uncrushed.has('testkey'))
    const result = await uncrushed.get('testkey')
    assert.strictEqual(result, 'testvalue')
  })
  test('multiple keys', async () => {
    let hamt = Hamt.create()
    hamt = await hamt.crush()
    const diffs = hamt.getDiffBlocks()
    assert.strictEqual(diffs.size, 1)
    expect(diffs).toMatchSnapshot()
    const resolver = (cid) => diffs.get(cid.toString())
    hamt = await Hamt.uncrush(hamt.cid, resolver)
    for (let i = 0; i < 100; i++) {
      hamt = await hamt.set('test-' + i, { test: 'test-' + i })
    }
    let start = Date.now()
    hamt = await hamt.crush()
    debug(`crush: ${Date.now() - start} ms`)
    start = Date.now()
    const bigDiffs = hamt.getDiffBlocks()
    debug(`diffs: ${Date.now() - start} ms`)
    start = Date.now()
    const bigResolver = (cid) => bigDiffs.get(cid.toString())
    hamt = await Hamt.uncrush(hamt.cid, bigResolver)
    debug(`uncrush: ${Date.now() - start} ms`)

    start = Date.now()
    assert.deepEqual(await hamt.get('test-59'), { test: 'test-59' })
    debug(`deep get: ${Date.now() - start} ms`)

    start = Date.now()
    assert.deepEqual(await hamt.get('test-58'), { test: 'test-58' })
    debug(`deep get 2: ${Date.now() - start} ms`)
  })
  test('with class', async () => {
    class TestClass extends IpldStruct {}
    let hamt = Hamt.create(TestClass)
    const msg = 'Not correct class type'
    await expect(hamt.set('test', { a: 'b' })).rejects.toThrow(msg)
    const testInstance = new TestClass()
    hamt = await hamt.set('test', testInstance)
    assert((await hamt.get('test')) instanceof TestClass)
    hamt = await hamt.crush()
    const diffs = hamt.getDiffBlocks()
    expect(diffs.size).toBe(2)
    expect(diffs).toMatchSnapshot()
    const resolver = (cid) => diffs.get(cid.toString())
    hamt = await Hamt.uncrush(hamt.cid, resolver, TestClass)
    const result = await hamt.get('test')
    assert(result instanceof TestClass)
  })
  test('throws on existing key', async () => {
    let hamt = Hamt.create()
    await expect(hamt.get('bogus key')).rejects.toThrow('bogus key')
    hamt = await hamt.set('some key', 'some value')
    assert.strictEqual(await hamt.get('some key'), 'some value')
    await expect(hamt.set('some key', 'over')).rejects.toThrow(
      'Cannot overwrite'
    )
  })
  test.todo('recursive crush')
})