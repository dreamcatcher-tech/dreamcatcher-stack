import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { Request, Pulse, Network, Channel, Address } from '..'
import * as utils from '../src/IpldUtils'
import Debug from 'debug'
const debug = Debug('interblock:tests:network')
Debug.enable('*ipld:Network')
chai.use(chaiAsPromised)

describe.only('network', () => {
  test('creates default', async () => {
    const network = Network.create()
    const crush = await network.crush()
    const diffs = await crush.getDiffBlocks()
    debug(diffs.size)
    assert(network.getParent())
    assert(network.getLoopback())
    assert.strictEqual(network.counter, 0)
  })
  test('cannot delete parent or self', async () => {
    const network = Network.create()
    await assert.isRejected(network.delete('..'), 'Cannot delete parent')
    await assert.isRejected(network.delete('.'), 'Cannot delete loopback')
    await assert.isRejected(network.delete('else'), 'key not present')
    await assert.isRejected(network.delete(4), 'Alias must be a string')
  })
  test('parent is unknown by default', () => {
    const network = Network.create()
    const parent = network.getParent()
    assert(parent)
    assert(parent.tx.genesis.isUnknown())
  })
  test('can only set Channel instances', async () => {
    const network = Network.create()
    await assert.isRejected(network.setChannel('else', 'test'), 'must supply')
    await assert.isRejected(network.setChannel('e', { t: 't' }), 'must supply')
  })
  test.only('transmit to downlink', async () => {
    let network = Network.create()
    let pulse = Pulse.create()
    pulse = await pulse.crush()
    const address = Address.generate(pulse)
    assert(!address.isUnknown())
    assert(address.isRemote())

    // set a downlink to have this address
    network = await network.resolveDownlink('/some/testalias', address)
    // send a tx
    const request = Request.create('TEST')
    network = await network.txRequest(request, 'testalias')
    // if channels doesn't hold it, then goes direct into tx slice
    network = await network.crush()
    console.dir(await network.getDiffBlocks(), { depth: null })

    // send a tx to an unknown alias
    // set address to resolved
    // send a reply

    network = network.openUplink(toAddress)

    network = network.setChild(alias, channel)

    const channel = Channel.create(address)
    const alias = 'testAlias'
    network = network.setChannel(alias, channel)
    assert.strictEqual(await network.getByAlias(alias), channel)
    assert.strictEqual(await network.getByAddress(address), channel)
  })
  test.todo('open uplink')
  test.todo('create child')
  test.todo('transmit to child')
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
