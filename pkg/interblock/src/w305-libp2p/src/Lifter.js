import { pipe } from 'it-pipe'
import assert from 'assert-fast'
import { peerIdFromString } from '@libp2p/peer-id'
import { PulseLink } from '../../w008-ipld/index.mjs'
import { pushable } from 'it-pushable'
import Debug from 'debug'
import { Announcer } from './Announcer.js'
import { NetEndurance } from '../index.js'
const debug = Debug('interpulse:libp2p:Lifter')
const PULSELIFTER = '/pulse/lifter/0.0.1'

export class Lifter {
  #libp2p
  #announcer
  #promises = new Map() // pulseLink : Promise
  #connections = new Map() // peerIdString : stream
  #netEndurance
  static create(announcer, libp2p) {
    assert(typeof libp2p.dialProtocol, 'function')
    assert(announcer instanceof Announcer)
    const instance = new Lifter()
    instance.#libp2p = libp2p
    instance.#announcer = announcer
    libp2p.handle(PULSELIFTER, instance.#getHandler())
    instance.#listenLiftRequests()
    return instance
  }
  uglyInjection(netEndurance) {
    assert(netEndurance instanceof NetEndurance)
    this.#netEndurance = netEndurance
  }
  async #listenLiftRequests() {
    for await (const request of this.#announcer.rxLifts()) {
      const { peerIdString, pulse, prior, type } = request
      debug('rxLifts %o', request)
      const blockStream = pushable({ objectMode: true })
      // WARNING streams are in parallel if no await for streamWalk
      this.#netEndurance.streamWalk(blockStream, pulse, prior, type)
      const stream = await this.#ensureConnection(peerIdString)
      if (!(typeof stream.push === 'function')) {
        console.error('stream.push is not a function')
        console.dir(stream, { depth: 10 })
        continue
      }
      pipe(blockStream, async (source) => {
        for await (const block of source) {
          stream.push(block.bytes)
        }
        debug('rxLifts ended')
      })
    }
    debug('#listenLiftRequests ended')
  }
  async #listenLiftsReceived(source) {
    function buffer(source) {
      // must drain the stream asap to avoid buffer overflow
      const queue = pushable()
      const drain = async () => {
        for await (const chunk of source) {
          const bytes = chunk.subarray()
          queue.push(bytes)
        }
      }
      drain().catch((error) => queue.end(error))
      return queue
    }
    pipe(source, buffer, async (source) => {
      for await (const bytes of source) {
        const block = await this.#netEndurance.pushLiftedBytes(bytes)
        const [tracker] = this.#promises.get(block.cid.toString()) || []
        if (tracker) {
          tracker.resolve()
        }
      }
    })
  }
  async #ensureConnection(peerIdString) {
    const peerId = peerIdFromString(peerIdString)
    if (!this.#connections.has(peerIdString)) {
      await this.#libp2p
        .dialProtocol(peerId, PULSELIFTER)
        .then((stream) => {
          debug('dial success')
          this.#setStream(peerIdString, stream)
        })
        .catch((err) => {
          debug('dial error', err)
        })
      // TODO handle rejection and clean up the connection
    }
    return this.#connections.get(peerIdString)
  }
  async lift(pulseId, prior, type) {
    assert(pulseId instanceof PulseLink)
    assert(!prior || prior instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type])
    // TODO dedupe on send and on server, since should not duplicate streams

    const key = pulseId.cid.toString()
    if (!this.#promises.has(key)) {
      this.#promises.set(key, new Set())
    }
    const promises = this.#promises.get(key)
    const tracker = {}
    promises.add(tracker)
    const promise = new Promise((resolve, reject) => {
      Object.assign(tracker, { resolve, reject })
      // TODO get feedback from announcer
      try {
        this.#announcer.broadCastLift(pulseId, prior, type)
      } catch (error) {
        reject(error)
      }
    })
    try {
      await promise
    } finally {
      debug('lift tip received for %s of type %s', pulseId, type)
      // loose requirement that lift tips come down in request order
      assert(promises.has(tracker))
      promises.delete(tracker)
      if (promises.size === 0) {
        this.#promises.delete(key)
      }
    }
    return promise
  }
  #getHandler() {
    return ({ stream, connection }) => {
      const { remotePeer } = connection
      const peerIdString = remotePeer.toString()
      debug('got connection from', peerIdString)
      this.#setStream(peerIdString, stream)
    }
  }
  #setStream(peerIdString, stream) {
    assert(!this.#connections.has(peerIdString))
    this.#listenLiftsReceived(stream.source)
    const push = pushable()
    pipe(push, stream.sink)
    this.#connections.set(peerIdString, push)
  }
  static get RECOVERY_TYPES() {
    return {
      pulse: 'The full pulse, without and hamts',
      hamtPulse: 'The full pulse, with hamts',
      deepPulse: 'The full pulse, with hamts, and with children, recursively',
      interpulse: 'Subset of the pulse, focused on a single address',
      crispPulse: 'Just enough pulse for browser applications, with hamts',
      crispDeepPulse: 'crispPulse, with hamts, and with children, recursively',
    }
  }
}
