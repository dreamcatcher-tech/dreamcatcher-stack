import chai, { assert } from 'chai/index.mjs'
import chaiAsPromised from 'chai-as-promised'
import { Request, Pulse, Network, Channel, Address } from '..'
import { fromString } from '../src/Address'
import * as utils from '../src/IpldUtils'
import Debug from 'debug'
const debug = Debug('interblock:tests:network')
Debug.enable('*ipld:Network')
chai.use(chaiAsPromised)

describe('network', () => {
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
    assert(parent.isUnknown())
  })
  test('can only set Channel instances', async () => {
    const network = Network.create()
    await assert.isRejected(network.setChannel('else', 'test'), 'must supply')
    await assert.isRejected(network.setChannel('e', { t: 't' }), 'must supply')
  })
  test('transmit to downlink', async () => {
    let network = Network.create()
    let pulse = Pulse.create()
    pulse = await pulse.crush()
    const address = Address.generate(pulse)
    assert(!address.isUnknown())
    assert(address.isRemote())

    network = await network.resolveDownlink('/some/testalias', address)
    const request = Request.create('TEST')
    network = await network.txRequest(request, 'testalias')
    network = await network.crush()
    const diffs = await network.getDiffBlocks()
    const resolver = (cid) => diffs.get(cid.toString())
    const uncrushed = await Network.uncrush(network.cid, resolver)
    assert.deepEqual(uncrushed, network)
    const rediffs = await uncrushed.getDiffBlocks()
    assert.strictEqual(rediffs.size, 0)
    const doubleCrushed = await network.crush()
    const doubleDiffs = await doubleCrushed.getDiffBlocks()
    assert.strictEqual(doubleDiffs.size, 0)
  })
  test('open uplink', async () => {
    let network = Network.create()
    const upAddress = fromString('test uplink')
    network = await network.addUplink(upAddress)
    const uplink = await network.getUplink(upAddress)
    assert(uplink instanceof Channel)
    assert.strictEqual(uplink.getAddress(), upAddress)
  })
  test('create child', async () => {
    let network = Network.create()
    network = await network.addChild('child1')

    // TODO
  })
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
