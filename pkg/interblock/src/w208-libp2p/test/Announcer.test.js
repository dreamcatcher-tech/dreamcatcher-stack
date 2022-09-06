import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { Announcer } from '..'
import Debug from 'debug'
import { Address, PulseLink } from '../../w008-ipld'
import assert from 'assert-fast'
const debug = Debug('test')

Debug.enable('*test* *Announcer *Connection')

const createNode = async () => {
  const node = await createLibp2p({
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/0'],
    },
    transports: [new TCP()],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
  })
  await node.start()
  return node
}

describe('protocol', () => {
  const address = Address.createCI('test pulselink address')
  const pulselink = PulseLink.createCrossover(address)

  test('direct', async () => {
    const [node1, node2] = await Promise.all([createNode(), createNode()])
    debug(`nodes created`)
    debug(`node1`, node1.peerId.toString())
    debug(`node2`, node2.peerId.toString())

    const announcer1 = Announcer.create(node1)
    const announcer2 = Announcer.create(node2)
    const address = Address.createCI('test address')
    debug(address)

    announcer2.announce(address, pulselink)
    const self = announcer2.subscribe(address)
    for await (const announcement of self) {
      assert.strictEqual(announcement, pulselink)
      debug('self announce')
      break
    }

    announcer1.addAddressPeer(address, node2.peerId)
    const stream = announcer1.subscribe(address)
    await node1.peerStore.addressBook.set(node2.peerId, node2.getMultiaddrs())
    debug(`nodes connected`)
    for await (const announcement of stream) {
      assert(pulselink.equals(announcement))
      break
    }
    await Promise.all([node1.stop(), node2.stop()])
  }, 2000)
})
