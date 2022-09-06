import { sigServer } from '@libp2p/webrtc-star-signalling-server'
import { createBitswap } from 'ipfs-bitswap'
import { createRepo } from 'ipfs-repo'
import { loadCodec } from '../src/loadCodec'
import { createBackend } from '../src/createBackend'
import assert from 'assert-fast'
import { Address, Keypair, Pulse, PulseLink } from '../../w008-ipld'
import { createLibp2p } from 'libp2p'
import { TCP } from '@libp2p/tcp'
import { Mplex } from '@libp2p/mplex'
import { KadDHT } from '@libp2p/kad-dht'
import { Noise } from '@chainsafe/libp2p-noise'
import { CID } from 'multiformats/cid'
import { decode } from '../../w008-ipld'
import all from 'it-all'
import { createRepo as createHardRepo } from 'ipfs-core-config/repo'
import Debug from 'debug'
import { Announcer } from './Announcer'
const debug = Debug('interpulse:PulseNet')

const ciRepo = () => createRepo('ciRepo', loadCodec, createBackend())

export class PulseNet {
  #net
  #repo
  #bitswap
  #keypair
  #announcer
  static async createCI(repo = ciRepo()) {
    const CI = true
    return this.create(repo, CI)
  }
  static async create(repo, CI) {
    const instance = new PulseNet()
    await instance.#init(repo, CI)
    return instance
  }
  async #init(repoOrPath, CI = false) {
    assert(repoOrPath, `must supply repo or path`)
    let repo = repoOrPath
    if (typeof repoOrPath === 'string') {
      const options = { path: repoOrPath }
      repo = createHardRepo(debug.extend('repo'), loadCodec, options)
    }
    assert.strictEqual(typeof repo.isInitialized, 'function')
    // TODO store the config in the root chain
    const options = {
      addresses: { listen: ['/ip4/0.0.0.0/tcp/0'] },
      transports: [new TCP()],
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      datastore: repo.datastore, // definitely correct as per ipfs
      dht: new KadDHT(),
    }
    if (!(await repo.isInitialized())) {
      debug('initializing repo', repo.path)
      this.#keypair = CI
        ? Keypair.createCI()
        : await Keypair.generate(repo.path)
      options.peerId = await this.#keypair.generatePeerId()
      const identity = this.#keypair.export()
      await repo.init({ identity })
    } else {
      const config = await repo.config.getAll()
      this.#keypair = Keypair.import(config.identity)
      options.peerId = await this.#keypair.generatePeerId()
    }
    if (repo.closed) {
      await repo.open()
    }

    this.#net = await createLibp2p(options)
    this.#announcer = Announcer.create(this.#net)
    await this.#net.start()
    // TODO start a webrtc signalling server if we are on nodejs

    this.#repo = repo
    this.#bitswap = createBitswap(this.#net, this.#repo.blocks)
    await this.#bitswap.start()
  }
  async stop() {
    await this.#bitswap.stop()
    await this.#net.stop()
    await this.#repo.close()
  }
  get repo() {
    return this.#repo
  }
  get libp2p() {
    return this.#net
  }
  get keypair() {
    return this.#keypair
  }
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())

    // TODO throw if stopped
    const blocks = pulse.getDiffBlocks()
    const manyBlocks = [...blocks.entries()].map(([, block]) => {
      return { key: block.cid, value: block.bytes }
    })
    const bitswap = await all(this.#bitswap.putMany(manyBlocks))
    if (isAppRoot(pulse)) {
      debug('isApproot', pulse)
      const address = pulse.getAddress()
      const pulselink = pulse.getPulseLink()
      await this.#announcer.announce(address, pulselink)
    }
    return bitswap
  }
  async dialCI(other) {
    assert(other instanceof PulseNet)
    // make a direct connection to the other pulsenet, for testing
    const { peerId } = other.#net
    const addrs = other.#net.getMultiaddrs()
    await this.#net.peerStore.addressBook.set(peerId, addrs)
    await this.#net.dial(peerId)
  }
  addAddressPeer(address, peerId) {
    // TODO make different trust levels, as well as a default peer
    this.#announcer.addAddressPeer(address, peerId)
  }
  subscribePulse(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    debug('subscribing to', address.toString())

    const stream = this.#announcer.subscribe(address)
    return stream

    // fetch out of bitswap
    // verify this is indeed the successor, or do some walking back
    // may layer this work into a Worker of some kind
    // return the stream to the caller
  }
  async getPulse(pulselink) {
    assert(pulselink instanceof PulseLink)
    const resolver = this.getResolver(pulselink.cid)
    const pulse = await Pulse.uncrush(pulselink.cid, resolver)
    return pulse
  }
  getResolver(treetop) {
    assert(treetop instanceof CID)
    // TODO WARNING permissions must be honoured
    // use treetop to only fetch things below this CID
    return async (cid) => {
      const bytes = await this.#bitswap.get(cid)
      const block = await decode(bytes)
      return block
    }
  }
}
const isAppRoot = (pulse) => {
  assert(pulse instanceof Pulse)
  // TODO delve into config and read out the actual approot
  // if no approot configured, then default to being self sovereign
  return true
}
