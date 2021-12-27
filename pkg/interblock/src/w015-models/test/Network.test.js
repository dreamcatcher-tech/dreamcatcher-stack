import { assert } from 'chai/index.mjs'
import * as snappy from 'snappy'
import * as snappyjs from 'snappyjs'
import flatstr from 'flatstr'
import { Buffer } from 'buffer'
import { stringify } from 'zipson'
import { Network, Channel, Address } from '..'

import Debug from 'debug'
const debug = Debug('interblock:tests:network')

describe('network', () => {
  test('creates default', () => {
    const network = Network.create()
    assert(network.get('..'))
    assert(network.get('.'))
    assert.strictEqual(network.size, 2)
  })
  test('cannot delete parent or self', () => {
    const network = Network.create()
    assert.throws(() => network.del('..'))
    assert.throws(() => network.del('.'))
  })
  test('parent is unknown by default', () => {
    const network = Network.create()
    const parent = network.get('..')
    assert(parent)
    assert(parent.address.isUnknown())
  })
  test('can only set Channel instances', () => {
    const network = Network.create()
    assert.throws(() => network.set('else', 'test'))
    assert.throws(() => network.set('else', { test: 'test' }))
  })
  test('get by address', () => {
    let network = Network.create()
    const address = Address.create('TEST')
    assert(!address.isUnknown())
    const channel = Channel.create(address)
    const alias = 'testAlias'
    network = network.set(alias, channel)
    assert.strictEqual(network.get(alias), channel)
    assert.strictEqual(network.getByAddress(address), channel)
  })
  test.skip('large network', () => {
    let network = Network.create()
    let channel = Channel.create()
    const count = 200000
    const next = {}
    for (let i = 0; i < count; i++) {
      const alias = `alias${i}`
      const address = Address.create('GENESIS')
      channel = Channel.create(address)
      // network = network.merge({ [alias]: channel })
      next[alias] = channel
    }
    let start = Date.now()
    network = network.setMany(next)
    debug(`time to %o: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = network.setMany({ addOne: channel })
    debug(`add one time %o ms`, Date.now() - start)
    start = Date.now()
    network = network.merge()
    debug(`merge time %o ms`, Date.now() - start)
    start = Date.now()
    const hash = network.hashString()
    debug(`hash time: %o ms %o`, Date.now() - start, hash.substr(0, 10))
    start = Date.now()
    network = network.setMany({ addTwo: channel }).merge()
    const hash2 = network.hashString()
    debug(`hash2 time: %o ms %o`, Date.now() - start, hash2.substr(0, 10))
    start = Date.now()
    const array = network.toArray()
    debug(`toArray: %o ms length: %o`, Date.now() - start, array.length)
    start = Date.now()
    const string = JSON.stringify(array)
    debug(`stringify: %o ms size: %o`, Date.now() - start, string.length)
    start = Date.now()
    flatstr(string)
    const buf = Buffer.from(string)
    debug(`conversion time: %o ms`, Date.now() - start)
    start = Date.now()
    const compressed = snappy.compressSync(buf)
    debug(`snappy %o ms size: %o`, Date.now() - start, compressed.length)
    start = Date.now()
    const compressed2 = snappyjs.compress(buf)
    debug(`snappyjs %o ms size: %o`, Date.now() - start, compressed2.length)
    start = Date.now()
    const compressed3 = stringify(array)
    debug(`zipson %o ms size: %o`, Date.now() - start, compressed3.length)
  })
  test.todo('rxReply always selected before rxRequest')
  test.todo('rxReply( request ) throws if non existant channel in request')
  test.todo('empty string cannot be used as channel name')
})
