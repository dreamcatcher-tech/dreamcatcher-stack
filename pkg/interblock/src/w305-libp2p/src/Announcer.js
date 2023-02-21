import assert from 'assert-fast'
import { peerIdFromString } from '@libp2p/peer-id'
import { Address, Pulse, PulseLink } from '../../w008-ipld/index.mjs'
import { pushable } from 'it-pushable'
import { Connection } from './Connection'
import Debug from 'debug'
const debug = Debug('interpulse:libp2p:Announcer')
const PROTOCOL = '/pulse/0.0.1'

export class Announcer {
  #libp2p
  #subscriptions = new Map() // chainId : sink[]
  // TODO use endurances method for latest
  #latests = new Map() // chainId : pulselink
  #peerMap = new Map() // chainId : peerIdString[]
  #connections = new Map() // peerIdString : Connection
  #rxUpdate = pushable({ objectMode: true })
  #rxAnnounce = pushable({ objectMode: true })
  static create(libp2p) {
    assert(typeof libp2p.dialProtocol, 'function')
    const instance = new Announcer()
    instance.#libp2p = libp2p
    libp2p.addEventListener('peer:discovery', instance.#getPeerListener())
    libp2p.handle(PROTOCOL, instance.#getHandler())
    instance.#listenUpdate()

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
      const wantedChainIds = this.#getWantlist(peerIdString)
      if (!wantedChainIds.size) {
        debug('no wanted chainIds for peer', peerIdString)
        return
      }
      const connection = this.#ensureConnection(peerIdString)
      for (const chainId of wantedChainIds) {
        connection.txSubscribe(chainId)
      }
    }
  }
  #getWantlist(peerIdString) {
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
    return ({ connection: { remotePeer }, stream }) => {
      const peerIdString = remotePeer.toString()
      debug('connection', peerIdString, this.#connections.has(peerIdString))
      assert(!this.#connections.has(peerIdString))
      // TODO what about teardown ?
      const connection = Connection.create(
        peerIdString,
        this.#rxUpdate,
        this.#rxAnnounce,
        this.#latests
      )
      connection.connectStream(stream)
      this.#connections.set(peerIdString, connection)
      const wantedChainIds = this.#getWantlist(peerIdString)
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

    // const connection = this.#ensureConnection(peerIdString)
    // connection.txSubscribe(chainId)
  }
  subscribeInterpulses() {
    return this.#rxAnnounce
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
    debug('broadcast txSubscribe', chainId)
    this.#broadcast(chainId, (cx) => cx.txSubscribe(chainId))
    return sink
  }
  #broadcast(chainId, operation) {
    assert.strictEqual(typeof chainId, 'string')
    assert.strictEqual(typeof operation, 'function')
    const results = []
    if (this.#peerMap.has(chainId)) {
      const peers = this.#peerMap.get(chainId)
      debug('found peers %s for chainId %s', peers.size, chainId)
      for (const peerIdString of peers) {
        const connection = this.#ensureConnection(peerIdString)
        results.push(operation(connection))
        debug('broadcast', chainId, peerIdString)
      }
    } else {
      debug('no peers for chainId', chainId)
    }
    return results
    // TODO store the operation to be done when new peers appear ?
  }
  #ensureConnection(peerIdString) {
    if (!this.#connections.has(peerIdString)) {
      const peerId = peerIdFromString(peerIdString)
      const connection = this.#dial(peerId)
      this.#connections.set(peerIdString, connection)
    }
    return this.#connections.get(peerIdString)
  }
  async latest(forAddress) {
    const onlyLatest = true
    const stream = this.subscribe(forAddress, onlyLatest)
    for await (const announcement of stream) {
      return announcement
    }
  }
  updatePulse(forAddress, latest) {
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
      connection.txUpdate(forAddress, latest)
    }
    if (!this.#subscriptions.has(chainId)) {
      return
    }
    const subscribers = this.#subscriptions.get(chainId)
    for (const sink of subscribers) {
      sink(latest)
    }
  }
  announce(source, target, address, root, path) {
    assert(source instanceof Pulse)
    assert(target instanceof Address)
    assert(address instanceof Address)
    assert(root instanceof PulseLink)
    assert.strictEqual(typeof path, 'string')
    // try dial some peers if none exist

    const rootChainId = address.getChainId()
    debug('seeking peers for txAnnounce', address)
    this.#broadcast(rootChainId, (connection) =>
      connection.txAnnounce(source, target, root, path)
    )
  }
  unsubscribe(forAddress) {
    assert(forAddress instanceof Address)
    throw new Error('not implemented')
  }

  async #listenUpdate() {
    for await (const update of this.#rxUpdate) {
      debug(`update`, update)
      const { fromAddress, latest, targetAddress } = update
      assert(fromAddress instanceof Address)
      assert(latest instanceof PulseLink)
      assert(!targetAddress || targetAddress instanceof Address)
      const chainId = fromAddress.getChainId()
      if (!this.#subscriptions.has(chainId)) {
        continue
      }
      this.#latests.set(chainId, latest)
      const subscribers = this.#subscriptions.get(chainId)
      for (const sink of subscribers) {
        sink.push(latest)
      }
    }
    debug('rxUpdate ended')
  }
  #dial(peerId) {
    const peerIdString = peerId.toString()
    debug('dial', peerIdString)
    const connection = Connection.create(
      peerIdString,
      this.#rxUpdate,
      this.#rxAnnounce,
      this.#latests
    )
    // TODO check if we have any addresses first
    // TODO endelessly try to dial
    this.#libp2p.dialProtocol(peerId, PROTOCOL).then((stream) => {
      connection.connectStream(stream)
    })
    // TODO handle rejection and clean up the connection
    return connection
  }
  serve(forAddress, latest) {
    assert(forAddress instanceof Address)
    assert(latest instanceof PulseLink)
    assert(forAddress.isRemote())
    assert(!this.#latests.has(forAddress.getChainId()))
    this.#latests.set(forAddress.getChainId(), latest)
  }
  stop() {
    this.#rxUpdate.return()
    this.#rxAnnounce.return()
    for (const connection of this.#connections.values()) {
      connection.stop()
    }
    for (const chainSubscribers of this.#subscriptions.values()) {
      for (const sink of chainSubscribers) {
        sink.return()
      }
    }
  }
}
const isPeerId = (peerId) => !!peerId[Symbol.for('@libp2p/peer-id')]
