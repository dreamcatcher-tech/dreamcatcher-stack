import { Channel, Hamt } from '..'
import { IpldStruct } from '../src/IpldStruct'
import { assert } from 'chai/index.mjs'
import Debug from 'debug'
import random from 'random'

const debug = Debug('tests')

describe('Hamt', () => {
  describe('maps', () => {
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
      const resolver = (cid) => [diffs.get(cid.toString())]
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
      const resolver = (cid) => [diffs.get(cid.toString())]
      hamt = await Hamt.uncrush(hamt.cid, resolver)
      for (let i = 0; i < 100; i++) {
        hamt = await hamt.set('test-' + i, { test: 'test-' + i })
      }
      let start = Date.now()
      hamt = await hamt.crush(resolver)
      debug(`crush: ${Date.now() - start} ms`)
      start = Date.now()
      const bigDiffs = hamt.getDiffBlocks()
      debug(`diffs: ${Date.now() - start} ms`)
      start = Date.now()
      const bigResolver = (cid) => [bigDiffs.get(cid.toString())]
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
      const resolver = (cid) => [diffs.get(cid.toString())]
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
    test('compare blank', async () => {
      const size = 53
      const raw = await hamtFactory(size)
      const base = await raw.crush()
      const diff = await base.compare()
      expect(diff.added.size).toEqual(53)
      expect(diff.deleted.size).toEqual(0)
      expect(diff.modified.size).toEqual(0)
    })
    test.todo('recursive crush')
  })
  describe('export', () => {
    test('with links as values', async () => {
      let hamt = Hamt.create(Channel)
      const value = Channel.create(29)
      hamt = await hamt.set('test', value)
      assert((await hamt.get('test')) instanceof Channel)
      hamt = await hamt.crush()
      const nextValue = await hamt.get('test')
      debug('channel cid', nextValue.cid)
      const blocks = new Map()
      const diff = hamt.getDiffBlocks()
      await hamt.export((cid) => {
        const block = diff.get(cid.toString())
        blocks.set(cid.toString(), block)
        return [block]
      })
      expect(blocks.size).toBe(3)
    })
  })
  describe('sizing', () => {
    test.skip('basic', async () => {
      const large = await hamtFactory(10)
      const largeCrushed = await large.crush()
      const diffs = largeCrushed.getDiffBlocks()
      diffs.size //?
      debug('diffs', diffs.size)

      const { open } = await import('fs/promises')
      const file = await open('crush.csv', 'w')
      let csv = 'bitWidth,bucketSize,'
      const counts = [10, 100, 1000, 10000]
      const zAxes = counts
        .map((c) => `blocks-${c},bytes-${c},time-${c}`)
        .join(',')
      csv += zAxes + '\n'
      await file.appendFile(csv)

      for (let bitWidth = 3; bitWidth < 17; bitWidth++) {
        for (let bucketSize = 2; bucketSize < 20; bucketSize++) {
          let row = `${bitWidth},${bucketSize}`
          for (const count of counts) {
            const hamt = await hamtFactory(count, bitWidth, bucketSize)
            hamt.bitWidth = bitWidth
            hamt.bucketSize = bucketSize
            const start = Date.now()
            const crushed = await hamt.crush()
            const time = Date.now() - start
            debug(`bitWidth ${bitWidth} bucketSize ${bucketSize}`)
            debug(`crush ${count} items in ${time} ms`)

            const diff = crushed.getDiffBlocks()
            debug(`diffs ${diff.size} blocks`)
            const size = [...diff.values()].reduce(
              (acc, block) => acc + block.bytes.length,
              0
            )
            debug(`size ${size} bytes`)
            debug(`keySize ${diff.size * 32}`)
            const bytes = size + diff.size * 32
            debug(`total ${bytes}`)
            const blocks = diff.size
            row += `,${blocks},${bytes},${time}`
          }
          csv += row + '\n'
          await file.appendFile(row + '\n')
        }
      }
      await file.close()
    })
  })
  describe('diffing', () => {
    test('basic', async () => {
      const raw = await hamtFactory()
      const base = await raw.crush()
      debug('start')

      let added = await base.set('addedKey', { test: 'added' })
      added = await added.crush()
      const addDiff = await added.compare(base)
      debug(addDiff)
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
    test('diff stress test', async () => {
      for (let i = 0; i < 10; i++) {
        const ipfsPersistence = new Map()
        const size = random.int(10, 100)
        debug(`iteration %i with size %i`, i, size)
        const diff = {
          added: new Set(),
          modified: new Set(),
          deleted: new Set(),
        }

        let base = await hamtFactory(size)
        base = await crush(base, ipfsPersistence)
        let next = base
        // choose an operation at random
        if (random.boolean()) {
          const addCount = random.int(1, 50)
          next = await add(next, diff, addCount)
          next = await crush(next, ipfsPersistence)
        }
        if (random.boolean()) {
          const modCount = random.int(10, 50)
          next = await mod(next, diff, modCount)
          next = await crush(next, ipfsPersistence)
        }
        if (random.boolean()) {
          const delCount = random.int(1, 50)
          next = await del(next, diff, delCount)
          next = await crush(next, ipfsPersistence)
        }

        debug('crushing')
        next = await next.crush()
        debug('comparing')
        const nextDiff = await next.compare(base)
        debug('comparing done')
        const addDiff = symmetricDifference(diff.added, nextDiff.added)
        expect(addDiff.size).toEqual(0)
        const delDiff = symmetricDifference(diff.deleted, nextDiff.deleted)
        expect(nextDiff.deleted).toEqual(diff.deleted)
        expect(delDiff.size).toEqual(0)
        const modDiff = symmetricDifference(diff.modified, nextDiff.modified)
        expect(modDiff.size).toEqual(0)
      }
    })
  })
})
const crush = async (hamt, ipfsMap) => {
  debug('crushing')
  const resolver = (cid) => [ipfsMap.get(cid.toString())]
  hamt = await hamt.crush(resolver)
  const diffBlocks = hamt.getDiffBlocks()
  diffBlocks.forEach((v, k) => ipfsMap.set(k, v))
  return hamt
}
const mod = async (hamt, diff, modCount) => {
  debug(`modifying %i`, modCount)
  const keys = []
  for await (const [key] of hamt.entries()) {
    keys.push(key)
  }
  const shuffled = keys
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
  for (let i = 0; i < modCount; i++) {
    if (!shuffled.length) {
      break
    }
    const key = shuffled.pop()
    const value = await hamt.get(key)
    hamt = await hamt.set(key, { ...value, modified: i })
    if (!diff.added.has(key)) {
      diff.modified.add(key)
    }
  }
  return hamt
}
const del = async (hamt, diff, delCount) => {
  debug(`deleting %i`, delCount)
  const keys = []
  for await (const [key] of hamt.entries()) {
    keys.push(key)
  }
  const shuffled = keys
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value)
  debug('keys listed')
  for (let i = 0; i < delCount; i++) {
    if (!shuffled.length) {
      break
    }
    const key = shuffled.pop()
    hamt = await hamt.delete(key)
    if (diff.added.has(key)) {
      diff.added.delete(key)
    } else {
      if (diff.modified.has(key)) {
        diff.modified.delete(key)
      }
      diff.deleted.add(key)
    }
  }
  return hamt
}
const add = async (hamt, diff, addCount) => {
  debug(`adding %i`, addCount)
  for (let i = 0; i < addCount; i++) {
    const key = 'added-' + i
    assert(!(await hamt.has(key)), 'key already exists')
    hamt = await hamt.set(key, { test: key })
    diff.added.add(key)
    assert(!diff.deleted.has(key))
    assert(!diff.modified.has(key))
  }
  return hamt
}
const hamtFactory = async (count = 100) => {
  const valueClass = undefined
  const isMutable = true
  let hamt = Hamt.create(valueClass, isMutable)
  for (let i = 0; i < count; i++) {
    hamt = await hamt.set('test-' + i, { test: 'test-' + i })
  }
  return hamt
}
const symmetricDifference = (setA, setB) => {
  const _difference = new Set(setA)
  for (const elem of setB) {
    if (_difference.has(elem)) {
      _difference.delete(elem)
    } else {
      _difference.add(elem)
    }
  }
  return _difference
}
