import assert from 'assert-fast'
import { Address, Pulse, PulseLink } from '../../w008-ipld'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { pushable } from 'it-pushable'
import { pipe } from 'it-pipe'
import { Connection } from './Connection'
import Debug from 'debug'
const debug = Debug('interpulse:libp2p:Announcer')

export class Announcer {
  #libp2p
  #subscriptions = new Map() // chainId : { latest, sinks[] }
  #peerMap = new Map() // chainId : peerIdString[]
  #connections = new Map() // peerIdString : Connection
  static create(libp2p) {
    assert(typeof libp2p.dialProtocol, 'function')
    const instance = new Announcer()
    instance.#libp2p = libp2p
    libp2p.addEventListener('peer:discovery', instance.#getPeerListener())
    libp2p.handle(protocol, instance.#getHandler())
    instance.#listen()
    return instance
  }
  #getPeerListener() {
    return (event) => {
      const { id, multiaddrs, protocols } = event.detail
      assert(isPeerId(id))
      debug('peer:discovery multiaddrs:')
      for (const addr of multiaddrs) {
        debug(`  `, addr.toString())
      }
      debug(`protocols`, protocols)
      const peerIdString = id.toString()

      if (this.#connections.has(peerIdString)) {
        return
      }

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
      if (!wantedChainIds.size) {
        return
      }

      const connection = this.#dial(id, wantedChainIds)
      this.#connections.set(peerIdString, connection)
    }
  }
  #getHandler() {
    return ({ connection, stream }) => {
      const peerIdString = connection.remotePeer.toString()
      debug('connection', peerIdString)
      // TODO figure out what we wanted from this peer, if anything
      // TODO collapse this function to share code with this.#dial()

      const tx = pushable({ objectMode: true })
      const rx = pushable({ objectMode: true })
      const _connection = Connection.create(tx, rx, this.#rxAnnounce)
      // TODO save the connection
      debug(stream)
      pipe(
        tx,
        async function* transform(source) {
          for await (const object of source) {
            debug('yield', object)
            const arraylist = to(object)
            yield arraylist
          }
        },
        stream
      )
      pipe(stream, async (source) => {
        for await (const arraylist of source) {
          const object = from(arraylist)
          rx.push(object)
        }
      })
    }
  }

  addAddressPeer(forAddress, peerId) {
    assert(forAddress instanceof Address)
    assert(isPeerId(peerId))
    debug('addAddressPeer')
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
    debug(`subscribe`, forAddress)
    this.#ensureSubscriptionFor(forAddress)
    const subscribers = this.#subscriptions.get(forAddress.getChainId())
    const sink = pushable({
      objectMode: true,
      onEnd: () => {
        debug('unsubscribe', forAddress)
        subscribers.sinks.delete(sink)
        if (!subscribers.sinks.size) {
          this.#subscriptions.delete(forAddress)
        }
      },
    })
    subscribers.sinks.add(sink)
    if (subscribers.latest) {
      sink.push(subscribers.latest)
    }

    // TODO dial all the peers we have

    return sink
  }
  async latest(address) {
    const onlyLatest = true
    const stream = this.subscribe(address, onlyLatest)
    let latest
    for await (const announcement of stream) {
      latest = announcement
      break // TODO make break automatically unsubscribe
    }
  }
  #ensureSubscriptionFor(forAddress) {
    assert(forAddress instanceof Address)
    const chainId = forAddress.getChainId()
    if (!this.#subscriptions.has(chainId)) {
      const subscribers = {
        latest: undefined,
        sinks: new Set(),
        links: new Set(),
      }
      this.#subscriptions.set(chainId, subscribers)
    }
  }

  async announce(forAddress, latest) {
    assert(forAddress instanceof Address)
    assert(latest instanceof PulseLink)
    const chainId = forAddress.getChainId()
    this.#ensureSubscriptionFor(forAddress)
    const subscribers = this.#subscriptions.get(chainId)
    if (subscribers.latest) {
      assert(!latest.equals(subscribers.latest))
    }
    subscribers.latest = latest
    for (const sink of subscribers.sinks) {
      await sink(latest)
    }
    for (const link of subscribers.links) {
      // call all the connections we have an announce to them
      link.announce(latest)
    }
    // remove this whole function
    Connection.updateGlobalAnnounces(forAddress, latest)
  }
  unsubscribe(forAddress) {
    assert(forAddress instanceof Address)
  }
  #rxAnnounce = pushable({ objectMode: true })
  async #listen() {
    for await (const announcement of this.#rxAnnounce) {
      debug(`announcement`, announcement)
      const { forAddress, pulselink } = announcement
      assert(forAddress instanceof Address)
      assert(pulselink instanceof PulseLink)
      const chainId = forAddress.getChainId()
      if (!this.#subscriptions.has(chainId)) {
        continue
      }
      const subscribers = this.#subscriptions.get(chainId)
      subscribers.latest = pulselink
      for (const sink of subscribers.sinks) {
        sink.push(pulselink)
      }
    }
  }
  #dial(peerId, wantedChainIds = new Set()) {
    const tx = pushable({ objectMode: true })
    const rx = pushable({ objectMode: true })
    const connection = Connection.create(tx, rx, this.#rxAnnounce)
    for (const chainId of wantedChainIds) {
      connection.txSubscribe(chainId)
    }
    const dial = async () => {
      const stream = await this.#libp2p.dialProtocol(peerId, protocol)
      debug(stream)
      pipe(
        tx,
        async function* transform(source) {
          for await (const object of source) {
            debug('yield', object)
            const arraylist = to(object)
            yield arraylist
          }
        },
        stream
      )
      pipe(stream, async (source) => {
        for await (const arraylist of source) {
          const object = from(arraylist)
          rx.push(object)
        }
      })
    }
    dial()
    return connection
  }
}

const to = (js) => {
  return fromString(JSON.stringify(js), 'utf8')
}
const from = (arraylist) => {
  return JSON.parse(toString(arraylist.subarray(), 'utf8'))
}
const isPeerId = (peerId) => !!peerId[Symbol.for('@libp2p/peer-id')]
const protocol = '/pulse/0.0.1'
