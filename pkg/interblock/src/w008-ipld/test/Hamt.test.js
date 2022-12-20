import { IpldStruct } from '../src/IpldStruct'
import { assert } from 'chai/index.mjs'
import { Hamt } from '../src/Hamt'
import Debug from 'debug'

const debug = Debug('tests')

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
  test.only('diffing', async () => {
    const valueClass = undefined
    const isMutable = true
    let base = Hamt.create(valueClass, isMutable)
    for (let i = 0; i < 10000; i++) {
      base = await base.set('test-' + i, { test: 'test-' + i })
    }
    base = await base.crush()
    Debug.enable('tests *hamt *putstore')
    debug('start')

    let added = await base.set('addedKey', { test: 'added' })
    added = await added.crush()
    const addDiff = await added.compare(base)
    debug(addDiff)
    const lost = await added.get('test-371')
    expect(lost).toEqual({ test: 'test-371' })
    expect([...addDiff.added]).toEqual(['addedKey'])
    expect(addDiff.modified.size).toEqual(0)
    expect(addDiff.deleted.size).toEqual(0)

    let deleted = await base.delete('test-0')
    deleted = await deleted.crush()
    const delDiff = await deleted.compare(base)
    debug(delDiff)
    expect([...delDiff.deleted]).toEqual(['test-0'])
    expect(delDiff.modified.size).toEqual(0)
    expect(delDiff.added.size).toEqual(0)

    let modified = await base.set('test-1', { test: 'modified' })
    modified = await modified.crush()
    const modDiff = await modified.compare(base)
    debug(modDiff)
    expect([...modDiff.modified]).toEqual(['test-1'])
    expect(modDiff.deleted.size).toEqual(0)
    expect(modDiff.added.size).toEqual(0)
  })
  test.todo('recursive crush')
})
