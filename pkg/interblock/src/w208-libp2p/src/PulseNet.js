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
import { decode } from '../../w008-ipld'
import all from 'it-all'
import delay from 'delay'
import Debug from 'debug'
const debug = Debug('interpulse:PulseNet')
const MS_DELAY = 50

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
      addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
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
    // TODO hook into topology events, or some other way to know
    // when new peers join dht, try insert into them, or read from them
    // when new peers subscribe in pubsub, try publish to them
    // TODO await pubsub peers, and race between them
    const isDhtPeers = () =>
      this.#net.dht.lan.routingTable.size > 0 ||
      this.#net.dht.wan.routingTable.size > 0
    return new Promise((resolve, reject) => {
      const wait = async () => {
        let waited = 0
        while (!isDhtPeers() && this.#net.started) {
          // TODO cancel this request if a superseding request is issued
          await delay(MS_DELAY)
          waited += MS_DELAY
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

    debug('announce\n%s\n%s', address.cid.toString(), pulse.cid.toString())
    const provide = this.awaitDhtPeers().then(() => {
      return this.#net.contentRouting.provide(address.cid)
    })
    const key = address.cid.bytes
    const value = pulse.cid.bytes
    const dht = this.awaitDhtPeers().then(() => {
      return all(this.#net.dht.put(key, value))
    })

    const topic = address.cid.toString()
    const pubsub = this.#publish(topic, value)

    return { provide, dht, pubsub }
  }
  async #publish(topic, value) {
    // store the result, and verify how many peers we have published this to
    // if new peers come online, and listen to this topic, we want to tell them
    // if we restart, we want to ensure we reinflate our cache
    await this.awaitDhtPeers()
    try {
      await this.#net.pubsub.publish(topic, value)
      debug('published', topic)
    } catch (error) {
      if (error.message === 'PublishError.InsufficientPeers') {
        await delay(MS_DELAY)
        return this.#publish(topic, value)
      }
      throw error
    }
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
    debug(`pubsubSubscribe to:`, topic)
    this.#net.pubsub.subscribe(topic)
    this.#pubsubSubscribers.set(topic, callback)
    return () => {
      this.#net.pubsub.unsubscribe(topic)
      this.#pubsubSubscribers.delete(callback)
    }
  }
  #pubsub(event) {
    const { topic } = event.detail
    // TODO handle multiple subscribers
    const subscriber = this.#pubsubSubscribers.get(topic)
    debug('pubsub event received', topic)
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
    const emissions = new Set()
    return new EventIterator(({ push }) => {
      const withAwait = async () => {
        await this.awaitDhtPeers()
        debug(`begin EventIterator for`, address)
        const dedupedPush = (pulselink) => {
          const pulseString = pulselink.cid.toString()
          if (emissions.has(pulseString)) {
            debug('duplicate emission ignored')
            return
          }
          emissions.add(pulseString)
          push(pulselink)
        }
        this.#pubsubSubscribe(address.cid.toString(), (data) => {
          const pulselink = PulseLink.parse(data)
          debug(`pubsub for %s\nreceived %s`, address, pulselink)
          dedupedPush(pulselink)
        })
        const key = address.cid.bytes
        for await (const result of this.#net.dht.get(key)) {
          // TODO trigger when dht updates are received, too
          // TODO if no pubsubs in some timeout, requery the dht
          if (result.name === 'VALUE') {
            const pulselink = PulseLink.parse(result.value)
            debug('dht value', pulselink, result.type)
            dedupedPush(pulselink)
          }
        }
      }
      withAwait()
      return () => {
        //TODO do cleanup
      }
    })

    // do some checks against bitswap to verify what we received
    // build this module as raw traffic, with a sanity reconciler coordinator
  }
  async getPulse(pulselink) {
    assert(pulselink instanceof PulseLink)
    // call on bitswap to get the pulse
    // check the local repo first
    const resolver = async (cid) => {
      const bytes = await this.#bitswap.get(cid)
      const block = await decode(bytes)
      return block
    }
    const pulse = await Pulse.uncrush(pulselink.cid, resolver)
    return pulse
  }
}
const isAppRoot = (pulse) => {
  assert(pulse instanceof Pulse)
  // TODO delve into config and read out the actual approot
  // if no approot configured, then default to being self sovereign
  return true
}
