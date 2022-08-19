import { jest } from '@jest/globals'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { CID } from 'multiformats/cid'
import { KadDHT } from '@libp2p/kad-dht'
import all from 'it-all'
import delay from 'delay'
import Debug from 'debug'
import { Pulse } from '../../w008-ipld'
const debug = Debug('interpulse:tests:dht')

Debug.enable('*tests*')

const createNode = async () => {
  const node = await createLibp2p({
    addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
    transports: [new TCP()],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
    dht: new KadDHT(),
  })

  await node.start()
  return node
}

describe('dht', () => {
  test.only('basic', async () => {
    const [node1, node2, node3] = await Promise.all([
      createNode(),
      createNode(),
      createNode(),
    ])

    await node1.peerStore.addressBook.set(node2.peerId, node2.getMultiaddrs())
    await node2.peerStore.addressBook.set(node3.peerId, node3.getMultiaddrs())

    await Promise.all([node1.dial(node2.peerId), node2.dial(node3.peerId)])
    Debug.enable('libp2p:kad-dht* *tests*')

    let count = 0
    while (!node1.dht.lan.routingTable.size) {
      await delay(0)
      count++
    }
    debug(`rt`, node1.dht.lan.routingTable.size, `count`, count)

    Debug.enable('*tests*')
    // Debug.enable('libp2p:kad-dht*')
    const pulse = await Pulse.createCI()
    const { cid } = pulse.getAddress()
    // const { cid } = pulse
    // const cid = CID.parse('QmTp9VkYvnHyrqKQuFPiuZkiX9gPcqj6x5LJ1rmWuSySnL')
    await node1.contentRouting.provide(cid)

    debug('Node %s is providing %s', node1.peerId.toString(), cid.toString())

    // wait for propagation
    // await delay(300)

    const providers = await all(
      node3.contentRouting.findProviders(cid, { timeout: 3000 })
    )

    debug('Found provider:', providers[0].id.toString())

    const key = fromString('butcher')
    const value = fromString('bananas')
    const putResult = await all(node1.dht.put(key, value))
    debug('value was', 'bananas', value)

    for await (const result of node3.dht.get(key)) {
      if (result.name === 'VALUE') {
        debug('value', toString(result.value), result.type)
      }
    }

    debug('############## switch')
    await all(node1.dht.put(key, fromString('pickle')))
    for await (const result of node3.dht.get(key)) {
      if (result.name === 'VALUE') {
        debug('value', toString(result.value), result.type)
      }
    }
  }, 5000)
  test.todo('latest is recovered from storage on reload')
})
