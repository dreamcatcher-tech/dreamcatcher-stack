import { assert } from 'chai/index.mjs'
import { List, Map, Record } from 'immutable'
import clone from 'lodash.clone'
import { blockProducer, signatureProducer } from '../../w016-producers'
import * as crypto from '../../w012-crypto'
import Debug from 'debug'
import { Block, Dmz, Keypair } from '../../w015-models'
const debug = Debug('interblock:tests:blockProducer')

describe('blockProducer', () => {
  describe('generateUnsigned', () => {
    test('false signing rejected', async () => {
      const block = Block.create()
      const keypairA = Keypair.create('keypairA')
      const keypairB = Keypair.create('keypairB')
      const dmz = Dmz.create({
        state: { test: 'changedState' },
        validators: keypairA.getValidatorEntry(),
      })
      const unsigned = blockProducer.generateUnsigned(dmz, block)
      assert(!unsigned.isVerifiedBlock())
      const { integrity } = unsigned.provenance
      const signature = await signatureProducer.sign(integrity, keypairA)
      const next = blockProducer.assemble(unsigned, signature)
      assert(next.isVerifiedBlock())
      assert(block.isNextBlock(next))

      const falseSignature = await signatureProducer.sign(integrity, keypairB)
      assert(!falseSignature.equals(signature))
      assert.throws(() => blockProducer.assemble(unsigned, falseSignature))
    })
    test('throws if no dmz or block provided', () => {
      assert.throws(blockProducer.generateUnsigned)
      const dmz = Dmz.create()
      assert.throws(() => blockProducer.generateUnsigned(dmz))
    })
    test('no duplicates created', () => {
      const block = Block.create()
      const dmz = block.getDmz()
      assert.throws(() => blockProducer.generateUnsigned(dmz, block))
    })
    test('pass serialize test', () => {
      const block = Block.create()
      const state = { test: 'state' }
      const nextDmz = Dmz.clone({ ...block.getDmz(), state })
      const nextBlock = blockProducer.generateUnsigned(nextDmz, block)
      const json = nextBlock.serialize()
      assert.strictEqual(typeof json, 'string')
      const clone = Block.clone(json)
      assert(clone.equals(nextBlock))
    })
    test.skip('dual validator signing', () => {
      const kp1 = crypto.generateKeyPair()
      const kp2 = crypto.generateKeyPair()
      const keypair1 = Keypair.create('CI1', kp1)
      const keypair2 = Keypair.create('CI2', kp2)
      const duo = Dmz.create({
        validators: { alice: keypair1.publicKey, bob: keypair2.publicKey },
      })
    })
  })
  describe('big block production', () => {
    // goal is to have constant time for block operations, regardless of how many children it has
    test.skip('batch 1000 spawns', async () => {
      Debug.enable('*tests*')
      // const init = Block.create()
      // make object with 20,000 keys, which is design target
      const big = {}
      let i = 0
      const count = 10000
      debug('start')
      while (i < count) {
        i++
        big[`key-${i}`] = { a: i }
      }
      debug('create')
      big.direct = true
      debug('direct mutation: ')
      const next = { ...big, test: true } //
      debug('Object spread')

      const arr = Object.keys(big)
      debug('keys')
      const arrSpread = [...arr] // 1ms - near instant
      debug('array spread')

      let j = arr.length
      const whileLoop = []
      while (j--) {
        whileLoop[j] = arr[j]
      }
      debug(`while loop`)

      const sliced = arr.slice()
      debug('slice')

      const arrFrozen = Object.freeze(arrSpread)
      debug('frozen array')
      const frozenObj = Object.freeze(next) // adds 33ms to the operation
      debug('frozen object shallow') // ? if each key was an object too, deepfreeze expensive ?

      arrSpread.find((item) => !item)
      debug('worst case find')
      const m = arrSpread[arrSpread.length - 1]
      debug('array access')
      const n = big['key-' + count]
      debug('object access')
      const assigned = Object.assign({}, big)
      debug('Object.assign')
      const shortAssign = Object.assign(big, { assign: true })
      debug('Object.assign short')

      const cloneObj = clone(big)
      debug('lodash.clone(big)')
      const loCloneArr = clone(arr)
      debug('lodash.clone(arr)')

      // immutable
      const list = List(arr)
      debug('immutable list')
      const list2 = list.insert(10000, false)
      debug('immutable list insert')
      const list3 = list.push('something')
      debug('immutable list push')

      const map = Map(big)
      debug('immutable map')
      const map2 = map.set('meow', true)
      debug('immutable map set')
      const keys = map.keys()
      debug('immutable map keys')
      i = 0
      const baseMap = Map()
      while (i < count) {
        i++
        baseMap.set(`key-${i}`, true)
      }
      debug('immutable map create')
      const mapInsert = map.set('key-10000', 'test')
      assert(mapInsert.get('key-10000') === 'test')
      debug('immutable map set')
      const hashCode = mapInsert.hashCode()
      debug('immutable map hashCode', hashCode)

      const isEqual = map.equals(mapInsert)
      assert(!isEqual)
      debug('immutable map equals')
      const isEqual2 = mapInsert.equals(map)
      assert(!isEqual2)
      debug('immutable map equals reverse')
      const isEqual3 = map.equals(map)
      assert(isEqual3)
      debug('immutable map equals actually equal')

      // const rlist = List()
      // const r = Record({ a: 1, b: 2 })
      // i = 0
      // while (i < 1000000) {
      //   i++
      //   rlist.push(r({ a: `key-${i}` }))
      // }
      // debug('immutable record create 1M') // about 3s or 3x longer than raw

      // //immer tests
      // const immerNext = produce(big, (draft) => {
      //   draft.immer = true
      // })
      // debug('immer update with freeze') // 5s!!
      // const immerUnfrozen = produce(frozenObj, (draft) => {
      //   draft.immer2 = true
      // })
      // debug('immer update without freeze') // 4s
      // setAutoFreeze(false)
      // const immerNoAuto = produce(frozenObj, (draft) => {
      //   draft.immer3 = true
      // })
      // debug('immer update no auto') // 4s
    })
    test('big networkModel', () => {
      // make a reducer that dispatches a large number of requests out ?
      // exercise the time of every network model operation
      // test clone times work as expected
    })
    test('block clone during add signature is constant time', async () => {
      // generate a big block
      // change the dmz or add a legit signature
      // time the cloning
      // do the same for the small block
      // verify the clone time is the exact same
    })
  })
})
