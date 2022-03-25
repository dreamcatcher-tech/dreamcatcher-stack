import { assert } from 'chai/index.mjs'
import { Pulse, Network, Channel, Address } from '..'
import * as utils from '../src/IpldUtils'
import Debug from 'debug'
const debug = Debug('interblock:tests:network')
Debug.enable()

describe('network', () => {
  test('creates default', async () => {
    const network = Network.create()
    const crush = await network.crush()
    const diffs = await crush.getDiffBlocks()
    debug(diffs.size)
    assert(network.getByAlias('..'))
    assert(network.getByAlias('.'))
    assert.strictEqual(network.counter, 2)
  })
  test('cannot delete parent or self', () => {
    const network = Network.create()
    assert.throws(() => network.delete('..'), 'Cannot delete parent')
    assert.throws(() => network.delete('.'), 'Cannot delete loopback')
    assert.throws(() => network.delete('else'), 'else has not')
    assert.throws(() => network.delete(4), '4 has not')
  })
  test('parent is unknown by default', () => {
    const network = Network.create()
    const parent = network.getByAlias('..')
    assert(parent)
    assert(parent.tx.genesis.isUnknown())
  })
  test('can only set Channel instances', () => {
    const network = Network.create()
    assert.throws(() => network.setChannel('else', 'test'), 'must supply')
    assert.throws(() => network.setChannel('else', { t: 't' }), 'must supply')
  })
  test('get by address', async () => {
    let network = Network.create()
    const pulse = await Pulse.create().crush()
    const address = Address.generate(pulse)
    assert(!address.isUnknown())
    const channel = Channel.create(address)
    const alias = 'testAlias'
    network = network.setChannel(alias, channel)
    assert.strictEqual(network.getByAlias(alias), channel)
    assert.strictEqual(network.getByAddress(address), channel)
  })
  test.todo('same channel results in same channelId')
  test.todo('diffs only give difference to previous crush')
  test('large network', async () => {
    let network = Network.create()
    let channel = Channel.create()
    const count = 20
    let start = Date.now()
    for (let i = 0; i < count; i++) {
      const alias = `alias${i}`
      const address = Address.createGenesis()
      channel = Channel.create(address)
      network = network.setChannel(alias, channel)
    }
    debug(`time to %o: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = network.setChannel('addOne', channel)
    debug(`add one time %o ms`, Date.now() - start)
    start = Date.now()
    network = await network.crush()
    debug(`crush first time %o ms`, Date.now() - start, network.cid)
    start = Date.now()
    const diffs1 = await network.getDiffBlocks()
    debug(`diffs: %o ms length: %o`, Date.now() - start, diffs1.size)
    start = Date.now()
    network = network.setChannel('addTwo', channel)
    network = await network.crush()
    debug(`crush second time: %o ms %o`, Date.now() - start, network.cid)
    start = Date.now()
    const diffs2 = await network.getDiffBlocks()
    debug(`diffs: %o ms length: %o`, Date.now() - start, diffs2.size)
  })
  test.todo('rxReply always selected before rxRequest')
  test.todo('rxReply( request ) throws if non existant channel in request')
  test.todo('empty string cannot be used as channel name')
})
