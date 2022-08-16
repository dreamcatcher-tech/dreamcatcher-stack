import delay from 'delay'
import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { FloodSub } from '@libp2p/floodsub'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { toString as uint8ArrayToString } from 'uint8arrays/to-string'
import { GossipSub } from '@chainsafe/libp2p-gossipsub'
import Debug from 'debug'
Debug.log = console.log.bind(console)
const debug = Debug('interpulse:tests:network')
Debug.enable('*tests*')

const createNode = async () => {
  const node = await createLibp2p({
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/0'],
    },
    transports: [new TCP()],
    streamMuxers: [new Mplex()],
    connectionEncryption: [new Noise()],
    pubsub: new FloodSub(),
  })

  await node.start()
  return node
}
describe('network', () => {
  test.only('pubsub', async () => {
    /* eslint-disable no-console */

    const topic = 'fruit'

    const [node1, node2, node3] = await Promise.all([
      createNode(),
      createNode(),
      createNode(),
    ])

    // node1 conect to node2 and node2 conect to node3
    await node1.peerStore.addressBook.set(node2.peerId, node2.getMultiaddrs())
    await node1.dial(node2.peerId)

    await node2.peerStore.addressBook.set(node3.peerId, node3.getMultiaddrs())
    await node2.dial(node3.peerId)
    Debug.enable('libp2p:pubsub* *floodsub* *tests*')

    //subscribe
    node1.pubsub.subscribe(topic)
    node1.pubsub.addEventListener('message', (evt) => {
      // Will not receive own published messages by default
      debug(`node1 received: ${uint8ArrayToString(evt.detail.data)}`)
    })

    node2.pubsub.subscribe(topic)
    node2.pubsub.addEventListener('message', (evt) => {
      debug(`node2 received: ${uint8ArrayToString(evt.detail.data)}`)
    })

    node3.pubsub.subscribe(topic)
    node3.pubsub.addEventListener('message', (evt) => {
      debug(`node3 received: ${uint8ArrayToString(evt.detail.data)}`)
    })

    const validateFruit = (msgTopic, msg) => {
      const fruit = uint8ArrayToString(msg.data)
      const validFruit = ['banana', 'apple', 'orange']

      if (!validFruit.includes(fruit)) {
        throw new Error('no valid fruit received')
      }
    }

    //validate fruit
    // node1.pubsub.topicValidators.set(topic, validateFruit)
    // node2.pubsub.topicValidators.set(topic, validateFruit)
    // node3.pubsub.topicValidators.set(topic, validateFruit)

    await delay(500)
    // node1 publishes "fruits" every five seconds
    var count = 0
    const myFruits = ['banana', 'apple', 'car', 'orange']
    // car is not a fruit !
    // setInterval(() => {
    debug('############## fruit ' + myFruits[count] + ' ##############')
    node1.pubsub
      .publish(topic, uint8ArrayFromString(myFruits[count]))
      .catch((err) => {
        console.info(err)
      })
    count++
    if (count == myFruits.length) {
      count = 0
    }
    // }, 500)
    await delay(3000)
  })
})
