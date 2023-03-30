import { CID } from 'multiformats/cid'
import { isNode } from 'wherearewe'
import process from 'process'
import { createRepo } from 'ipfs-repo'
import { loadCodec } from '../src/loadCodec'
import { createBackend } from '../src/createBackend'
import assert from 'assert-fast'
import {
  decode,
  Address,
  Keypair,
  Pulse,
  PulseLink,
} from '../../w008-ipld/index.mjs'
import { createLibp2p } from 'libp2p'
import { mplex } from '@libp2p/mplex'
import { noise } from '@chainsafe/libp2p-noise'
import { webSockets } from '@libp2p/websockets'
import { isMultiaddr, multiaddr as fromString } from '@multiformats/multiaddr'
import { createRepo as createHardRepo } from 'ipfs-core-config/repo'
import { libp2pConfig } from 'ipfs-core-config/libp2p'
import { Announcer } from './Announcer'
import { Lifter } from './Lifter'
import { peerIdFromString } from '@libp2p/peer-id'
import { all as filter } from '@libp2p/websockets/filters'
import Debug from 'debug'
import { pushable } from 'it-pushable'

const debug = Debug('interpulse:libp2p:PulseNet')

const ciRepo = () => createRepo('ciRepo', loadCodec, createBackend())

export class PulseNet {
  #libp2p
  #repo
  #keypair
  #announcer
  #lifter
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
      // minSendBytes is like nagles algorithm, to prevent small packets
      streamMuxers: [mplex({ minSendBytes: 2 * 1024 * 1024 })],
      connectionEncryption: [noise()],
      datastore: repo.datastore, // definitely correct as per ipfs
    }
    delete options.metrics // TODO remove once libp2p is fixed
    const websocketsOptions = { filter }
    if (isNode) {
      const listen = [`/ip4/${tcpHost}/tcp/${tcpPort}/ws`]
      const { SSL_PRIVATE_KEY, SSL_CERT_CHAIN } = process.env
      if (SSL_PRIVATE_KEY && SSL_CERT_CHAIN) {
        await checkCertificate(SSL_CERT_CHAIN)
        debug('using SSL certificates')
        const https = await import('https')
        websocketsOptions.server = https.createServer({
          cert: SSL_CERT_CHAIN,
          key: SSL_PRIVATE_KEY,
        })
        listen.length = 0
        listen.push(`/ip4/${tcpHost}/tcp/${tcpPort}/wss`)
      }
      options.addresses = { listen }
    }
    options.transports = [webSockets(websocketsOptions)]

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
    this.#lifter = Lifter.create(this.#announcer, this.#libp2p)

    this.#repo = repo
    this.#putsDrained = this.#drainPuts()
    this.#getsDrained = this.#drainGets()
    debug('listening on', this.#libp2p.getMultiaddrs())
  }
  async stop() {
    this.#puts.end()
    this.#gets.end()
    await this.#putsDrained
    await this.#getsDrained
    await stopSafe(() => this.#announcer.stop())
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
    const promises = [...blocks.values()].map((block) => this.putBlock(block))
    const repoResults = await Promise.all(promises)
    const address = pulse.getAddress()
    const pulselink = pulse.getPulseLink()
    this.#announcer.updatePulse(address, pulselink)
    return repoResults
  }
  async announce(source, target, address, root, path) {
    return await this.#announcer.announce(source, target, address, root, path)
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
  subscribeInterpulses() {
    return this.#announcer.subscribeInterpulses()
  }
  uglyInjection(netEndurance) {
    this.#lifter.uglyInjection(netEndurance)
  }
  subscribePulse(address) {
    assert(address instanceof Address)
    assert(address.isRemote())
    debug('subscribing to', address.toString())

    return this.#announcer.subscribe(address)
    // TODO use a worker to verify and catch up on announcements
  }
  async lift(pulseId, prior, type) {
    assert(pulseId instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type])
    await this.#lifter.lift(pulseId, prior, type)
    debug('lifted %s prior %s type %s', pulseId, prior, type)
  }
  async stats() {
    const repo = await this.#repo.stat()
    // TODO collect Lifter stats
    return { repo }
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
  async hasBlock(cid, abort) {
    assert(CID.asCID(cid))
    return await this.#repo.blocks.has(cid)
  }
  async getBlock(cid, abort) {
    assert(CID.asCID(cid))
    let cb
    const promise = new Promise((resolve) => (cb = resolve))
    this.#gets.push({ cid, cb })
    return await promise
  }
  #gets = pushable({ objectMode: true })
  #getsDrained
  async #drainGets() {
    const buffer = []
    const callbacks = new Map()
    for await (const { cid, cb } of this.#gets) {
      const key = cid.toString()
      if (!callbacks.has(key)) {
        callbacks.set(key, [])
      }
      const callbacksArray = callbacks.get(key)
      callbacksArray.push(cb)
      if (callbacksArray.length > 1) {
        continue
      }
      buffer.push(cid)
      if (this.#gets.readableLength) {
        continue
      }
      for await (const bytes of this.#repo.blocks.getMany(buffer)) {
        const block = await decode(bytes)
        const callbacksArray = callbacks.get(block.cid.toString())
        assert(callbacksArray.length)
        callbacksArray.forEach((cb) => cb(block))
      }
      buffer.length = 0
      callbacks.clear()
    }
  }
  async putBlock(block, abort) {
    assert(CID.asCID(block.cid))
    let cb
    const promise = new Promise((resolve) => (cb = resolve))
    this.#puts.push({ block, cb })
    return await promise
  }
  #puts = pushable({ objectMode: true })
  #putsDrained
  async #drainPuts() {
    // TODO merge with #drainGets()
    const buffer = []
    const callbacks = new Map()
    for await (const { block, cb } of this.#puts) {
      const key = block.cid.toString()
      if (!callbacks.has(key)) {
        callbacks.set(key, [])
      }
      const callbacksArray = callbacks.get(key)
      callbacksArray.push(cb)
      if (callbacksArray.length > 1) {
        continue
      }
      buffer.push({ key: block.cid, value: block.bytes })
      if (this.#puts.readableLength) {
        continue
      }
      for await (const { key } of this.#repo.blocks.putMany(buffer)) {
        const callbacksArray = callbacks.get(key.toString())
        assert(callbacksArray.length)
        callbacksArray.forEach((cb) => cb())
      }
      buffer.length = 0
      callbacks.clear()
    }
  }
}
const stopSafe = async (fn) => {
  try {
    await fn()
  } catch (err) {
    debug('stop error', err)
  }
}
const checkCertificate = async (cert) => {
  assert.strictEqual(typeof cert, 'string')
  let expiresOn
  try {
    const { default: pem } = await import('pem')
    const { promisify } = await import('util')
    const info = promisify(pem.readCertificateInfo)
    const check = await info(cert)
    const { end } = check.validity
    expiresOn = end
  } catch (error) {
    console.log('could not load pem:', error.message)
    return
  }
  if (Date.now() > expiresOn) {
    const date = new Date(expiresOn)
    throw new Error('Certificate Expired on: ' + date)
  }
  console.log('Certificate expiry:', new Date(expiresOn))
}
