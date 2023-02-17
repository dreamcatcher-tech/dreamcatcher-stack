import { isNode } from 'wherearewe'
import process from 'process'
import { createBitswap } from 'ipfs-bitswap'
import { createRepo } from 'ipfs-repo'
import { loadCodec } from '../src/loadCodec'
import { createBackend } from '../src/createBackend'
import assert from 'assert-fast'
import {
  Address,
  Keypair,
  Pulse,
  PulseLink,
  decode,
} from '../../w008-ipld/index.mjs'
import { createLibp2p } from 'libp2p'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'
import { webSockets } from '@libp2p/websockets'
import { isMultiaddr, multiaddr as fromString } from '@multiformats/multiaddr'
import { CID } from 'multiformats/cid'
import all from 'it-all'
import { createRepo as createHardRepo } from 'ipfs-core-config/repo'
import { libp2pConfig } from 'ipfs-core-config/libp2p'
import { Announcer } from './Announcer'
import { peerIdFromString } from '@libp2p/peer-id'
import { all as filter } from '@libp2p/websockets/filters'
import Debug from 'debug'

const debug = Debug('interpulse:libp2p:PulseNet')

const ciRepo = () => createRepo('ciRepo', loadCodec, createBackend())

export class PulseNet {
  #libp2p
  #repo
  #bitswap
  #keypair
  #announcer
  #isCreated = false
  static async createCI(repo = ciRepo()) {
    const CI = true
    return this.create(repo, CI)
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
      streamMuxers: [new mplex()],
      connectionEncryption: [new noise()],
      datastore: repo.datastore, // definitely correct as per ipfs
    }
    delete options.metrics // TODO remove once libp2p is fixed
    const websocketsOptions = { filter }
    if (isNode) {
      const listen = [`/ip4/${tcpHost}/tcp/${tcpPort}/ws`]
      const { SSL_PRIVATE_KEY, SSL_CERT_CHAIN } = process.env
      if (SSL_PRIVATE_KEY && SSL_CERT_CHAIN) {
        debug('using SSL certificates')
        const https = await import('https')
        websocketsOptions.server = https.createServer({
          cert: SSL_CERT_CHAIN,
          key: SSL_PRIVATE_KEY,
        })
        listen.push(`/ip4/${tcpHost}/tcp/${tcpPort}/wss`)
      }
      options.addresses = { listen }
    }
    options.transports = [new webSockets(websocketsOptions)]

    if (!(await repo.isInitialized())) {
      debug('initializing repo', repo.path)
      this.#isCreated = true
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
    // TODO lazy load this
    this.#libp2p = await createLibp2p(options)
    this.#announcer = Announcer.create(this.#libp2p)

    this.#repo = repo
    const bsOptions = { statsEnabled: true }
    this.#bitswap = createBitswap(this.#libp2p, this.#repo.blocks, bsOptions)
    await this.#bitswap.start()
    debug('listening on', this.#libp2p.getMultiaddrs())
  }
  async stop() {
    await stopSafe(() => this.#announcer.stop())
    await stopSafe(() => this.#bitswap.stop())
    await stopSafe(() => this.#libp2p.stop())
    await stopSafe(() => this.#repo.close())
  }
  get repo() {
    return this.#repo
  }
  get libp2p() {
    return this.#libp2p
  }
  get keypair() {
    return this.#keypair
  }
  get isCreated() {
    return this.#isCreated
  }
  async endure(pulse) {
    assert(pulse instanceof Pulse)
    assert(pulse.isVerified())

    // TODO throw if stopped
    const blocks = pulse.getDiffBlocks()
    const manyBlocks = [...blocks.entries()].map(([, block]) => {
      return { key: block.cid, value: block.bytes }
    })
    const bitswapResults = await all(this.#bitswap.putMany(manyBlocks))
    const address = pulse.getAddress()
    const pulselink = pulse.getPulseLink()
    this.#announcer.updatePulse(address, pulselink)

    return bitswapResults
  }
  async announce(source, target, root, path) {
    return await this.#announcer.announceInterpulse(source, target, root, path)
  }
  async dialCI(other) {
    assert(other instanceof PulseNet)
    // make a direct connection to the other pulsenet, for testing
    const { peerId } = other.#libp2p
    const addrs = other.#libp2p.getMultiaddrs()
    await this.#libp2p.peerStore.addressBook.set(peerId, addrs)
    await this.#libp2p.dial(peerId)
  }
  addAddressPeer(address, peerId) {
    // TODO make different trust levels, as well as a default peer
    if (typeof address === 'string') {
      address = Address.fromChainId(address)
    }
    if (typeof peerId === 'string') {
      peerId = peerIdFromString(peerId)
    }
    this.#announcer.addAddressPeer(address, peerId)
  }
  async addMultiAddress(multiaddr) {
    if (typeof multiaddr === 'string') {
      multiaddr = fromString(multiaddr)
    }
    assert(isMultiaddr(multiaddr))
    assert(multiaddr.getPeerId())
    const peerId = peerIdFromString(multiaddr.getPeerId())
    debug('addMultiAddress', multiaddr.toString(), peerId.toString())
    await this.#libp2p.peerStore.addressBook.set(peerId, [multiaddr])
  }
  interpulses() {
    return this.#announcer.interpulses()
  }
  subscribePulse(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    debug('subscribing to', address.toString())

    return this.#announcer.subscribe(address)
    // TODO use a worker to verify and catch up on announcements
  }
  async getPulse(pulselink) {
    assert(pulselink instanceof PulseLink)
    const resolver = this.getResolver(pulselink.cid)
    const pulse = await Pulse.uncrush(pulselink.cid, resolver)
    return pulse
  }
  getResolver(treetop) {
    assert(CID.asCID(treetop))
    // TODO WARNING permissions must be honoured
    // TODO use treetop to only fetch things below this CID
    return async (cid) => {
      assert(CID.asCID(cid), `not cid: ${cid}`)
      const bytes = await this.#bitswap.get(cid)
      const block = await decode(bytes)
      return block
    }
  }
  async stats() {
    const repo = await this.#repo.stat()
    const bitswap = this.#bitswap.stat().snapshot
    return { repo, bitswap }
  }
  getMultiaddrs() {
    const addrs = this.#libp2p.getMultiaddrs()
    return addrs.map((addr) => addr.toString())
  }
  serve(pulse) {
    assert(pulse instanceof Pulse)
    const address = pulse.getAddress()
    const pulseLink = pulse.getPulseLink()
    this.#announcer.serve(address, pulseLink)
  }
}
const stopSafe = async (fn) => {
  try {
    await fn()
  } catch (err) {
    debug('stop error', err)
  }
}
