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
import { CID } from 'multiformats/cid'
import { decode } from '../../w008-ipld'
import all from 'it-all'
import { createRepo as createHardRepo } from 'ipfs-core-config/repo'
import { libp2pConfig } from 'ipfs-core-config/libp2p'
import { Announcer } from './Announcer'
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
    const baseOptions = libp2pConfig()
    const options = {
      ...baseOptions,
      streamMuxers: [new Mplex()],
      connectionEncryption: [new Noise()],
      datastore: repo.datastore, // definitely correct as per ipfs
    }
    if (isNode) {
      options.addresses = { listen: ['/ip4/0.0.0.0/tcp/0'] }
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
}
const isAppRoot = (pulse) => {
  assert(pulse instanceof Pulse)
  const { appRoot } = pulse.provenance.dmz
  if (!appRoot) {
    return true
  }
  return false
}
