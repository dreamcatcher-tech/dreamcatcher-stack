import assert from 'assert-fast'
import { peerIdFromString } from '@libp2p/peer-id'
import { Address, PulseLink } from '../../w008-ipld/index.mjs'
import { pushable } from 'it-pushable'
import { Connection } from './Connection'
import Debug from 'debug'
const debug = Debug('interpulse:libp2p:Announcer')

export class Announcer {
  #libp2p
  #subscriptions = new Map() // chainId : sink[]
  // TODO use endurances method for latest
  #latests = new Map() // chainId : pulselink
  #peerMap = new Map() // chainId : peerIdString[]
  #connections = new Map() // peerIdString : Connection
  static create(libp2p) {
    assert(typeof libp2p.dialProtocol, 'function')
    const instance = new Announcer()
    instance.#libp2p = libp2p
    libp2p.addEventListener('peer:discovery', instance.#getPeerListener())
    libp2p.handle(PROTOCOL, instance.#getHandler())
    instance.#listen()
    return instance
  }
  #getPeerListener() {
    return (event) => {
      const { id: peerId, multiaddrs, protocols } = event.detail
      assert(isPeerId(peerId))
      debug('peer:discovery multiaddrs:')
      for (const addr of multiaddrs) {
        debug(`  `, addr.toString())
      }
      debug(`protocols`, protocols)
      const peerIdString = peerId.toString()
      if (this.#connections.has(peerIdString)) {
        debug('already connected to peer', peerIdString)
        return
      }
      const wantedChainIds = this.#getWantlist(peerId)
      if (!wantedChainIds.size) {
        debug('no wanted chainIds for peer', peerIdString)
        return
      }
      const connection = this.#dial(peerId)
      this.#connections.set(peerIdString, connection)
      for (const chainId of wantedChainIds) {
        connection.txSubscribe(chainId)
      }
    }
  }
  #getWantlist(peerId) {
    const peerIdString = peerId.toString()
    const wantedChainIds = new Set()
    for (const chainId of this.#subscriptions.keys()) {
      if (this.#peerMap.has(chainId)) {
        const peers = this.#peerMap.get(chainId)
        if (peers.has(peerIdString)) {
          wantedChainIds.add(chainId)
          continue
        }
      }
    }
    return wantedChainIds
  }
  #getHandler() {
    return ({ connection: cx, stream }) => {
      const peerId = cx.remotePeer
      const peerIdString = peerId.toString()
      debug('connection', peerIdString)
      assert(!this.#connections.has(peerIdString))
      // TODO what about teardown ?
      const connection = Connection.create(this.#rxAnnounce, this.#latests)
      connection.connectStream(stream)
      this.#connections.set(peerIdString, connection)
      const wantedChainIds = this.#getWantlist(peerId)
      for (const chainId of wantedChainIds) {
        connection.txSubscribe(chainId)
      }
    }
  }
  addAddressPeer(forAddress, peerId) {
    assert(forAddress instanceof Address)
    assert(isPeerId(peerId))
    debug('addAddressPeer', forAddress.toString(), peerId.toString())
    const chainId = forAddress.getChainId()
    if (!this.#peerMap.has(chainId)) {
      this.#peerMap.set(chainId, new Set())
    }
    const peers = this.#peerMap.get(chainId)
    const peerIdString = peerId.toString()
    if (peers.has(peerIdString)) {
      return
    }
    peers.add(peerIdString)
    if (!this.#subscriptions.has(chainId)) {
      return
    }

    let connection
    if (this.#connections.has(peerIdString)) {
      connection = this.#connections.get(peerIdString)
    } else {
      connection = this.#dial(peerId)
      this.#connections.set(peerIdString, connection)
    }
    connection.txSubscribe(chainId)
  }
  subscribe(forAddress, onlyLatest = false) {
    // TODO handle concurrent subscribes gracefully
    assert(forAddress instanceof Address)
    assert(forAddress.isRemote())
    debug(`subscribe`, forAddress.toString())
    const chainId = forAddress.getChainId()
    if (!this.#subscriptions.has(chainId)) {
      this.#subscriptions.set(chainId, new Set())
    }
    const subscribers = this.#subscriptions.get(chainId)
    const sink = pushable({
      objectMode: true,
      onEnd: () => {
        debug('unsubscribe', forAddress)
        subscribers.delete(sink)
        if (!subscribers.size) {
          this.#subscriptions.delete(chainId)
          // TODO close down any idle connections
        }
      },
    })
    subscribers.add(sink)
    if (this.#latests.has(chainId)) {
      sink.push(this.#latests.get(chainId))
    }
    if (this.#peerMap.has(chainId)) {
      const peers = this.#peerMap.get(chainId)
      for (const peerIdString of peers) {
        if (!this.#connections.has(peerIdString)) {
          const peerId = peerIdFromString(peerIdString)
          const connection = this.#dial(peerId)
          this.#connections.set(peerIdString, connection)
        }
        const connection = this.#connections.get(peerIdString)
        connection.txSubscribe(chainId)
      }
    }
    return sink
  }
  async latest(forAddress) {
    const onlyLatest = true
    const stream = this.subscribe(forAddress, onlyLatest)
    for await (const announcement of stream) {
      return announcement
    }
  }
  async announce(forAddress, latest) {
    assert(forAddress instanceof Address)
    assert(latest instanceof PulseLink)
    const chainId = forAddress.getChainId()
    if (!this.#latests.has(chainId)) {
      return
    }
    debug(`announce`, forAddress.toString(), latest.toString())

    const previous = this.#latests.get(chainId)
    assert(!latest.equals(previous))
    this.#latests.set(chainId, latest)
    for (const connection of this.#connections.values()) {
      connection.txAnnounce(forAddress, latest)
    }
    if (!this.#subscriptions.has(chainId)) {
      return
    }
    const subscribers = this.#subscriptions.get(chainId)
    for (const sink of subscribers) {
      sink(latest)
    }
  }
  unsubscribe(forAddress) {
    assert(forAddress instanceof Address)
    throw new Error('not implemented')
  }
  #rxAnnounce = pushable({ objectMode: true })
  async #listen() {
    for await (const announcement of this.#rxAnnounce) {
      debug(`announcement`, announcement)
      const { forAddress, latest } = announcement
      assert(forAddress instanceof Address)
      assert(latest instanceof PulseLink)
      const chainId = forAddress.getChainId()
      if (!this.#subscriptions.has(chainId)) {
        continue
      }
      this.#latests.set(chainId, latest)
      const subscribers = this.#subscriptions.get(chainId)
      for (const sink of subscribers) {
        sink.push(latest)
      }
    }
  }
  #dial(peerId) {
    debug('dial', peerId.toString())
    const cx = Connection.create(this.#rxAnnounce, this.#latests)
    // TODO check if we have any addresses first
    // TODO endelessly try to dial
    this.#libp2p.dialProtocol(peerId, PROTOCOL).then((stream) => {
      cx.connectStream(stream)
    })
    // TODO handle rejection and clean up the connection
    return cx
  }
  serve(forAddress, latest) {
    assert(forAddress instanceof Address)
    assert(latest instanceof PulseLink)
    assert(forAddress.isRemote())
    assert(!this.#latests.has(forAddress.getChainId()))
    this.#latests.set(forAddress.getChainId(), latest)
  }
}
const isPeerId = (peerId) => !!peerId[Symbol.for('@libp2p/peer-id')]
const PROTOCOL = '/pulse/0.0.1'
