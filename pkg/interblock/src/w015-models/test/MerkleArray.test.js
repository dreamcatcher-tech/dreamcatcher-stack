import { assert } from 'chai/index.mjs'
import Debug from 'debug'
import { addressModel, channelModel } from '..'
import { MerkleArray } from '../src/classes/MerkleArray'

const debug = Debug('interblock:tests:MerkleArray')
describe('MerkleArray', () => {
  test('basic', () => {
    let ma = new MerkleArray()
    ma = ma.push(false)
    ma = ma.push(true)
    ma = ma.del(1)
    ma = ma.push(false)
    let fork = ma
    ma = ma.update(0, true)
    assert(ma.get(0))
    ma = ma.compact()
    ma = ma.merge()
    debug(ma.serialize())

    const hash = ma.hash()
    debug(hash)
    fork = fork.compact().merge()
    debug(fork.hash())
  })
  test('random', () => {
    let index = 0
    const count = 10
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
      debug(op, i)
      const index = Math.floor(Math.random() * arr.length)
      switch (op) {
        case 'push':
          arr.push(r)
          ma = ma.push(r)
          addCount++
          break
        case 'del': {
          let usedIndex = index
          while (arr[usedIndex] === undefined) {
            usedIndex = Math.floor(Math.random() * arr.length)
          }
          delete arr[usedIndex]
          ma = ma.del(usedIndex)
          delCount++
          break
        }
        case 'put':
          arr[index] = r
          ma = ma.update(index, r)
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
    debug(ma.hash())
    const result = JSON.parse(ma.serialize())
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
      network = network.push({ [alias]: channel })
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
    network = network.pushBulk(values)
    debug(`time to batch push %o units: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = network.merge()
    debug(`time to merge: %o ms`, Date.now() - start)
    start = Date.now()
    const arr = JSON.parse(network.serialize())
    assert.strictEqual(arr.length, count)
    debug(`time to serialize, then parse: %o ms`, Date.now() - start)
    start = Date.now()
    network = network.push({ addOne: channel }).merge()
    debug(`add one then merge time %o ms`, Date.now() - start)
    start = Date.now()
    const hash = network.hash()
    debug(`hash time: %o ms`, Date.now() - start)
    start = Date.now()
    network = network.push({ addTwo: channel })
    network = network.merge()
    const hash2 = network.hash()
    assert(hash !== hash2, `${hash} !== ${hash2}`)
    assert.strictEqual(hash.length, hash2.length)
    debug(`hash2 time: %o ms`, Date.now() - start)
    start = Date.now()
    const string = network.serialize()
    debug(`serialize: %o ms size: %o`, Date.now() - start, string.length)
  })
  test.todo('hash is same after reinflate')
})
