import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'
import { Announcer } from '..'
import Debug from 'debug'
import { Address, PulseLink } from '../../w008-ipld'
import assert from 'assert-fast'
const debug = Debug('test')

const createNode = async () => {
  const node = await createLibp2p({
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/0'],
    },
    transports: [new tcp()],
    streamMuxers: [new mplex()],
    connectionEncryption: [new noise()],
  })
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

    const client = Announcer.create(node1)
    const server = Announcer.create(node2)
    debug(address)

    server.serve(address, pulselink)
    const self = server.subscribe(address)
    for await (const announcement of self) {
      assert.strictEqual(announcement, pulselink)
      debug('self announce')
      break
    }

    client.addAddressPeer(address, node2.peerId)
    const stream = client.subscribe(address)
    const multiaddrs = node2.getMultiaddrs()
    await node1.peerStore.merge(node2.peerId, { multiaddrs })
    debug(`nodes connected`)
    for await (const announcement of stream) {
      assert(pulselink.equals(announcement))
      break
    }
    await Promise.all([node1.stop(), node2.stop()])
  })
  test('redial', async () => {
    const [node1, node2] = await Promise.all([createNode(), createNode()])
    const client = Announcer.create(node1)

    client.addAddressPeer(address, node2.peerId)
    client.subscribe(address)
    await Promise.all([node1.stop(), node2.stop()])
  })
})
