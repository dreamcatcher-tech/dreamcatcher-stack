import { assert } from 'chai/index.mjs'
import { addressModel, channelModel } from '../..'
import { MerkleArray } from '../../src/classes/MerkleArray'
import Debug from 'debug'
const debug = Debug('interblock:tests:MerkleArray')

describe('MerkleArray', () => {
  test('basic', () => {
    let ma = new MerkleArray()
    ma = ma.add(false)
    ma = ma.add(true)
    ma = ma.remove(1)
    ma = ma.add(false)
    let fork = ma
    ma = ma.put(0, true)
    assert(ma.get(0))
    ma = ma.compact()
    ma = ma.merge()
    debug(ma.toArray())

    const hash = ma.hashString()
    debug(`hash`, hash)
    const origin = fork.compact().merge()
    debug(`origin.hashString()`, origin.hashString())
    fork = origin.put(0, false)
    const diff = fork.diff()
    const next = fork.merge()
    const next2 = origin.patch(diff)
    assert.deepStrictEqual(next.toArray(), next2.toArray())
  })
  test('random', () => {
    let index = 0
    const count = 100
    while (index < count) {
      index++
      randomizer()
    }
  })
  const randomizer = () => {
    const arr = []
    const arrLength = 100
    for (let i = 0; i < arrLength; i++) {
      const r = Math.random()
      arr.push(r)
    }
    let addCount = 0,
      delCount = 0
    let ma = new MerkleArray(arr)
    for (let i = 0; i < 100; i++) {
      const r = Math.random()
      const op = r < 0.3 ? 'push' : r < 0.6 ? 'del' : 'put'
      const index = Math.floor(Math.random() * arr.length)
      switch (op) {
        case 'push':
          arr.push(r)
          ma = ma.add(r)
          addCount++
          break
        case 'del': {
          let usedIndex = index
          while (arr[usedIndex] === undefined) {
            usedIndex = Math.floor(Math.random() * arr.length)
          }
          delete arr[usedIndex]
          ma = ma.remove(usedIndex)
          delCount++
          break
        }
        case 'put':
          arr[index] = r
          ma = ma.put(index, r)
          break
      }
    }
    assert(arr.every((v, i) => v === ma.get(i)))
    const plan = ma.getCompactPlan()
    assert(plan.every(([index]) => arr[index] === undefined))
    let holeCount = 0
    for (const v of arr) {
      if (v === undefined) {
        holeCount++
      }
    }
    debug(`addCount`, addCount)
    debug(`delCount`, delCount)
    debug(`arr.length`, arr.length)
    debug(`plan.length`, plan.length)
    debug(`holeCount`, holeCount)
    assert.strictEqual(arr.length, arrLength + addCount)
    for (const [to, from] of plan) {
      arr[to] = arr[from]
      delete arr[from]
    }
    assert(
      arr.every((v, i) => {
        if (i >= arr.length - holeCount) {
          return v === undefined
        }
        return true
      })
    )
    ma = ma.compact()
    ma = ma.merge()
    debug(`hash %o`, ma.hashString().substr(0, 9))
    const result = JSON.parse(JSON.stringify(ma.toArray()))
    const trimmed = arr.filter((v) => v !== undefined)
    assert.deepStrictEqual(result, trimmed)
  }
  test('large values', () => {
    let network = new MerkleArray()
    let channel = channelModel.create()
    let start = Date.now()
    const count = 61
    for (let i = 0; i < count; i++) {
      const alias = `alias${i}`
      const address = addressModel.create('GENESIS')
      channel = channelModel.create(address)
      network = network.add({ [alias]: channel })
    }
    debug(`time to immutable push %o units: %o ms`, count, Date.now() - start)
    start = Date.now()
    const values = []
    for (let i = 0; i < count; i++) {
      const alias = `alias${i}`
      const address = addressModel.create('GENESIS')
      channel = channelModel.create(address)
      values.push(channel)
    }
    debug(`time to create raw %o units: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = new MerkleArray(values)
    debug(`time to create with base %o units: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = new MerkleArray()
    network = network.addBulk(values)
    debug(`time to batch push %o units: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = network.merge()
    debug(`time to merge: %o ms`, Date.now() - start)
    start = Date.now()
    const arr = JSON.parse(JSON.stringify(network.toArray()))
    assert.strictEqual(arr.length, count)
    debug(`time to serialize, then parse: %o ms`, Date.now() - start)
    start = Date.now()
    network = network.add({ addOne: channel }).merge()
    debug(`add one then merge time %o ms`, Date.now() - start)
    start = Date.now()
    const hash = network.hash()
    debug(`hash time: %o ms`, Date.now() - start)
    start = Date.now()
    network = network.add({ addTwo: channel })
    network = network.merge()
    const hash2 = network.hash()
    assert(hash !== hash2, `${hash} !== ${hash2}`)
    assert.strictEqual(hash.length, hash2.length)
    debug(`hash2 time: %o ms`, Date.now() - start)
    start = Date.now()
    const string = JSON.stringify(network.toArray())
    debug(`serialize: %o ms size: %o`, Date.now() - start, string.length)
  })
  test.todo('hash is same after reinflate')
})
