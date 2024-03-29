import { assert } from 'chai/index.mjs'
import { Request, Network, Channel, Address } from '..'
import Debug from 'debug'
const debug = Debug('interblock:tests:network')

describe('network', () => {
  test('creates default', async () => {
    const network = Network.create()
    const crush = await network.crushToCid()
    const diffs = crush.getDiffBlocks()
    const parent = await network.getParent()
    assert(parent.address.isUnknown())
    const loopback = await network.getLoopback()
    assert(loopback.address.isLoopback())
    assert.strictEqual(network.channels.counter, 3)
  })
  test('parent is unknown by default', async () => {
    const network = Network.create()
    const parent = await network.getParent()
    assert(parent)
    assert(parent.isUnknown())
  })
  test('can only set Channel instances', async () => {
    const network = Network.create()
    await expect(network.updateChannel('a string')).rejects.toThrow(
      'Not channel'
    )
    const object = { key: 'value' }
    await expect(network.updateChannel(object)).rejects.toThrow('Not channel')
  })
  test('transmit to downlink', async () => {
    let network = Network.create()
    const address = Address.createCI()
    assert(!address.isUnknown())
    assert(address.isRemote())

    network = await network.resolveDownlink('/some/testalias', address)
    const request = Request.create('TEST')
    let channel = await network.getChannel('/some/testalias')
    channel = channel.txRequest(request)
    network = await network.updateChannel(channel)
    network = await network.crushToCid()
    const diffs = network.getDiffBlocks()
    const resolver = (cid) => [diffs.get(cid.toString())]
    const uncrushed = await Network.uncrush(network.cid, resolver)
    assert.deepEqual(uncrushed, network)
    const rediffs = uncrushed.getDiffBlocks()
    assert.strictEqual(rediffs.size, 0)
    const doubleCrushed = await network.crushToCid()
    const doubleDiffs = doubleCrushed.getDiffBlocks()
    assert.strictEqual(doubleDiffs.size, 0)
  })
  test('open uplink', async () => {
    let network = Network.create()
    const upAddress = Address.createCI()
    network = await network.addUplink(upAddress)
    const uplink = await network.getUplink(upAddress)
    assert(uplink instanceof Channel)
    assert.strictEqual(uplink.address, upAddress)
  })
  test.todo('channel cannot have address changed once resolved')
  test('large network', async () => {
    let network = Network.create()
    const count = 20
    let start = Date.now()
    for (let i = 0; i < count; i++) {
      const alias = `/foreign/path/alias${i}`
      const address = Address.createCI(alias)
      network = await network.addDownlink(alias, address)
    }
    debug(`time to %o: %o ms`, count, Date.now() - start)
    start = Date.now()
    network = await network.addDownlink('remote/one', Address.createCI('one'))
    debug(`add one time %o ms`, Date.now() - start)
    start = Date.now()
    network = await network.crushToCid()
    debug(`crush first time %o ms`, Date.now() - start, network.cid)
    start = Date.now()
    const diffs1 = network.getDiffBlocks()
    debug(`diffs: %o ms length: %o`, Date.now() - start, diffs1.size)
    start = Date.now()
    network = await network.addDownlink('remote/two', Address.createCI('two'))
    network = await network.crushToCid()
    debug(`crush second time: %o ms %o`, Date.now() - start, network.cid)
    start = Date.now()
    const diffs2 = network.getDiffBlocks()
    debug(`diffs: %o ms length: %o`, Date.now() - start, diffs2.size)
  })
  test.todo('rxReply always selected before rxRequest')
  test.todo('rxReply( request ) throws if non existant channel in request')
  test.todo('empty string cannot be used as channel name')
})
