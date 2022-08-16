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
import { assert } from 'chai'
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
    // pubsub: new FloodSub(),
    pubsub: new GossipSub(),
  })
  await node.start()
  return node
}
describe('network', () => {
  test.only('pubsub', async () => {
    Debug.enable(' *tests*')
    debug(`start`)
    const topic = 'fruit'

    const [node1, node2, node3] = await Promise.all([
      createNode(),
      createNode(),
      createNode(),
    ])
    debug(`nodes created`)
    // node1 conect to node2 and node2 conect to node3
    await node1.peerStore.addressBook.set(node2.peerId, node2.getMultiaddrs())
    await node1.dial(node2.peerId)

    await node2.peerStore.addressBook.set(node3.peerId, node3.getMultiaddrs())
    await node2.dial(node3.peerId)
    debug(`nodes dialed`)

    let n1, n2, n3

    //subscribe
    node1.pubsub.addEventListener('message', (evt) => {
      // Will not receive own published messages by default
      debug(`node1 received: ${uint8ArrayToString(evt.detail.data)}`)
      n1 = true
    })
    node1.pubsub.subscribe(topic)

    node2.pubsub.addEventListener('message', (evt) => {
      debug(`node2 received: ${uint8ArrayToString(evt.detail.data)}`)
      n2 = true
    })
    node2.pubsub.subscribe(topic)

    const node3Promise = new Promise((r) => {
      node3.pubsub.addEventListener('message', (evt) => {
        debug(`node3 received: ${uint8ArrayToString(evt.detail.data)}`)
        n3 = true
        r()
      })
      node3.pubsub.subscribe(topic)
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

    node3.addEventListener('peer:discovery', (arg) =>
      debug(`peer:discovery`, arg)
    )
    node2.pubsub.addEventListener('subscription-change', (...args) => {
      debug(`2 subscription-change`, args)
    })
    node1.pubsub.addEventListener('subscription-change', (...args) => {
      debug(`1 subscription-change`, args)
    })
    await new Promise((r) => {
      node3.pubsub.addEventListener('subscription-change', (...args) => {
        debug(`3subscription-change`, args)
        // once we are subscribed, we should resolve a promise to say we are ready
        r()
      })
    })
    node3.connectionManager.addEventListener('peer:connect', (...args) => {
      debug(`peer:connect`, args)
    })
    // await delay(100)
    // node1 publishes "fruits" every five seconds
    var count = 0
    const myFruits = ['banana', 'apple', 'car', 'orange']
    // car is not a fruit !
    node3.pubsub.runHeartbeat() // without this, may publish too early
    debug('############## fruit ' + myFruits[count] + ' ##############')
    const result = await node1.pubsub
      .publish(topic, uint8ArrayFromString(myFruits[count]))
      .catch((err) => {
        console.info(err)
      })
    debug(`publish result`, result)
    count++
    if (count == myFruits.length) {
      count = 0
    }
    // }, 500)
    await node3Promise
    assert(!n1)
    assert(n2)
    assert(n3)
  })
})
