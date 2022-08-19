import { EventIterator } from 'event-iterator'
import { createBitswap } from 'ipfs-bitswap'
import { createRepo } from 'ipfs-repo'
import { loadCodec } from '../src/loadCodec'
import { createBackend } from '../src/createBackend'
import assert from 'assert-fast'
import { Address, Keypair, Pulse, PulseLink } from '../../w008-ipld'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { CID } from 'multiformats/cid'
import { KadDHT } from '@libp2p/kad-dht'
import { GossipSub } from '@chainsafe/libp2p-gossipsub'
import all from 'it-all'
import delay from 'delay'
import Debug from 'debug'
const debug = Debug('interpulse:PulseNet')

export class PulseNet {
  #net
  #repo
  #bitswap
  static async createCI() {
    const instance = new PulseNet()
    await instance.#init()
    return instance
  }
  constructor() {}
  async #init() {
    this.#net = await createLibp2p({
      addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
      transports: [new TCP()],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      dht: new KadDHT(),
      pubsub: new GossipSub(),
    })
    this.#net.pubsub.addEventListener('message', (e) => this.#pubsub(e))
    await this.#net.start()

    this.#repo = createRepo('rams', loadCodec, createBackend())
    if (!(await this.#repo.isInitialized())) {
      // workaround while waiting for
      // https://github.com/ipfs/js-ipfs/pull/4172
      let keypair
      // if (CI) {
      keypair = Keypair.createCI()
      // } else {
      // keypair = await Keypair.generate('ipex')
      // }
      // options.init.privateKey = await keypair.generatePeerId()
      // const validators = Validators.create([keypair.publicKey])
      // latest = await Pulse.createRoot({ CI, validators })
    }

    this.#bitswap = createBitswap(this.#net, this.#repo.blocks)
    await this.#bitswap.start()
  }

  endure(pulse) {
    // will read the approot and only announce if approot
    // if no approot, then treat like it is approot
    // store in repo, advertise address in provide
    // update the dht with 'latest' update
    // update the dht with any interpulse transmissions that are due
    // subscribe to the pubsub topic, and announce latest update
    // resolve the promise or async iterable letting dev eject whenever
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())

    const { provide, dht, pubsub } = this.#announce(pulse)
    const blocks = pulse.getDiffBlocks()
    const manyBlocks = [...blocks.entries()].map(([, block]) => {
      return { key: block.cid, value: block.bytes }
    })
    const bitswap = all(this.#bitswap.putMany(manyBlocks))
    const promise = Promise.all([provide, dht, pubsub, bitswap])
    Object.assign(promise, { provide, dht, pubsub, bitswap })

    return promise
  }
  async awaitDhtPeers() {
    const isDhtPeers = () =>
      this.#net.dht.lan.routingTable.size > 0 ||
      this.#net.dht.wan.routingTable.size > 0
    return new Promise((resolve, reject) => {
      const wait = async () => {
        const timeout = 30000
        let waited = 0
        while (!isDhtPeers()) {
          // TODO cancel this request if a superseding request is issued
          await delay(10)
          waited += 10
          if (waited >= timeout) {
            reject(new Error('Could not set DHT'))
          }
        }
        resolve()
      }
      wait()
    })
  }
  #announce(pulse) {
    if (!isAppRoot(pulse)) {
      return
    }
    const address = pulse.getAddress()
    assert(address.isRemote())

    const provide = this.awaitDhtPeers().then(() => {
      return this.#net.contentRouting.provide(address.cid)
    })
    const key = address.cid.bytes
    const value = pulse.cid.bytes
    const dht = this.awaitDhtPeers().then(() => {
      return all(this.#net.dht.put(key, value))
    })
    const pubsub = this.awaitDhtPeers().then(async () => {
      await delay(100)
      this.#net.pubsub.runHeartbeat() // without this, may publish too early
      const topic = address.cid.toString()
      return this.#net.pubsub.publish(topic, value)
    })

    return { provide, dht, pubsub }
  }
  async dialCI(other) {
    assert(other instanceof PulseNet)
    // make a direct connection to the other pulsenet, for testing
    const { peerId } = other.#net
    const addrs = other.#net.getMultiaddrs()
    await this.#net.peerStore.addressBook.set(peerId, addrs)
    await this.#net.dial(peerId)
    // without runHeartbeat(), may publish too early
    // this.#net.pubsub.runHeartbeat()
  }
  #pubsubSubscribers = new Map()
  #pubsubSubscribe(topic, callback) {
    assert.strictEqual(typeof topic, 'string')
    assert(topic)
    assert.strictEqual(typeof callback, 'function')
    this.#pubsubSubscribers.set(topic, callback)
    return () => this.#pubsubSubscribers.delete(callback)
  }
  #pubsub(event) {
    const { topic } = event.detail
    // TODO handle multiple subscribers
    const subscriber = this.#pubsubSubscribers.get(topic)
    debug('pubsub', topic)
    subscriber(event.detail.data)
  }
  subscribePulse(address) {
    // subscribes to the topic
    // initial will give a small delay
    // goes looking for the dht value first
    // if receives a pubsub in the meantime, will use this ?
    // will walk back to genesis before giving the first event
    // gets more peers using peer routing to help get more pulses
    // when receive from pubsub, will update the dht if it is more advanced
    // basically gets latest, validates it is latest, returns it,
    // then returns any future pulses, in order
    // if missed something, will seek it out
    // fetching the full pulse is up to the developer
    // byzantine behaviour is detected here

    assert(address instanceof Address)
    assert(address.isRemote())
    debug('subscribing to', address.toString())

    return new EventIterator(async ({ push, stop }) => {
      // this.addEventListener(event, push, options)
      // return () => this.removeEventListener(event, push, options)
      await this.awaitDhtPeers()
      this.#pubsubSubscribe(address.cid.toString(), (data) => {
        push(data)
      })
      const key = address.cid.bytes
      for await (const result of this.#net.dht.get(key)) {
        if (result.name === 'VALUE') {
          const pulselink = PulseLink.parse(result.value)
          debug('dht value', pulselink, result.type)
          push(pulselink)
        }
      }
    })

    // do some checks against bitswap to verify what we received
    // build this module as raw traffic, with a sanity reconciler coordinator
  }
}
const isAppRoot = (pulse) => {
  assert(pulse instanceof Pulse)
  // TODO delve into config and read out the actual approot
  // if no approot configured, then default to being self sovereign
  return true
}
