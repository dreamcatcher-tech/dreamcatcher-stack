import { isNode } from 'wherearewe'
import { createBitswap } from 'ipfs-bitswap'
import { createRepo } from 'ipfs-repo'
import { loadCodec } from '../src/loadCodec'
import { createBackend } from '../src/createBackend'
import assert from 'assert-fast'
import { Address, Keypair, Pulse, PulseLink } from '../../w008-ipld'
import { createLibp2p } from 'libp2p'
import { Mplex } from '@libp2p/mplex'
import { Noise } from '@chainsafe/libp2p-noise'
import { WebSockets } from '@libp2p/websockets'
import { isMultiaddr } from '@multiformats/multiaddr'
import { CID } from 'multiformats/cid'
import { decode } from '../../w008-ipld'
import all from 'it-all'
import { createRepo as createHardRepo } from 'ipfs-core-config/repo'
import { libp2pConfig } from 'ipfs-core-config/libp2p'
import { Announcer } from './Announcer'
import { peerIdFromString } from '@libp2p/peer-id'
import Debug from 'debug'
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
    let tcpHost
    if (isNode) {
      tcpHost = '0.0.0.0'
    }
    return this.create(repo, CI, tcpHost)
  }
  static async create(repo, CI, tcpHost, tcpPort) {
    const instance = new PulseNet()
    await instance.#init(repo, CI, tcpHost, tcpPort)
    return instance
  }
  async #init(repoOrPath, CI = false, tcpHost = '0.0.0.0', tcpPort = 0) {
    assert(repoOrPath, `must supply repo or path`)
    let repo = repoOrPath
    if (typeof repoOrPath === 'string') {
      const options = { path: repoOrPath }
      repo = createHardRepo(debug.extend('repo'), loadCodec, options)
    }
    assert.strictEqual(typeof repo.isInitialized, 'function')
    // TODO store the config in the root chain
    const baseOptions = libp2pConfig()
    const options = {
      ...baseOptions,
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      datastore: repo.datastore, // definitely correct as per ipfs
    }
    if (isNode) {
      // TODO start a webrtc signalling server if we are on nodejs
      options.addresses = { listen: [`/ip4/${tcpHost}/tcp/${tcpPort}/ws`] }
    }
    options.transports = [new WebSockets()]

    if (!(await repo.isInitialized())) {
      debug('initializing repo', repo.path)
      this.#keypair = CI
        ? Keypair.createCI()
        : await Keypair.generate(repo.path)
      options.peerId = await this.#keypair.generatePeerId()
      const identity = this.#keypair.export()
      await repo.init({ identity })
    } else {
      if (repo.closed) {
        await repo.open()
      }
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
    debug('listening on', this.#net.getMultiaddrs())

    this.#repo = repo
    const bsOptions = { statsEnabled: true }
    this.#bitswap = createBitswap(this.#net, this.#repo.blocks, bsOptions)
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
    const address = pulse.getAddress()
    const pulselink = pulse.getPulseLink()
    await this.#announcer.announce(address, pulselink)
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
  async addMultiAddress(multiaddr) {
    assert(isMultiaddr(multiaddr))
    assert(multiaddr.getPeerId())
    const peerId = peerIdFromString(multiaddr.getPeerId())
    await this.#net.peerStore.addressBook.set(peerId, [multiaddr])
  }
  subscribePulse(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    debug('subscribing to', address.toString())

    const stream = this.#announcer.subscribe(address)
    return stream
    // TODO use a worker to verify and catch up on announcements
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
    // TODO use treetop to only fetch things below this CID
    return async (cid) => {
      assert(cid instanceof CID, `not cid: ${cid}`)
      const bytes = await this.#bitswap.get(cid)
      const block = await decode(bytes)
      return block
    }
  }
  async stats() {
    const repo = await this.#repo.stat()
    const bitswap = this.#bitswap.stat().snapshot
    const net = this.#net.metrics.globalStats.getSnapshot()
    return { repo, bitswap, net }
  }
  getMultiaddrs() {
    const addrs = this.#net.getMultiaddrs()
    return addrs.map((addr) => addr.toString())
  }
}
