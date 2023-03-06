import { pipe } from 'it-pipe'
import * as lp from 'it-length-prefixed'
import assert from 'assert-fast'
import { peerIdFromString } from '@libp2p/peer-id'
import { PulseLink } from '../../w008-ipld/index.mjs'
import { pushable } from 'it-pushable'
import Debug from 'debug'
import { Announcer } from './Announcer.js'
import { CarReader } from '@ipld/car'
const debug = Debug('interpulse:libp2p:Lifter')
const PULSELIFTER = '/pulse/lifter/0.0.1'

export class Lifter {
  #libp2p
  #announcer
  #promises = new Map() // pulseLink : Promise
  #connections = new Map() // peerIdString : stream
  #resolveLifts = pushable({ objectMode: true })
  static create(announcer, libp2p) {
    assert(typeof libp2p.dialProtocol, 'function')
    assert(announcer instanceof Announcer)
    const instance = new Lifter()
    instance.#libp2p = libp2p
    instance.#announcer = announcer
    libp2p.handle(PULSELIFTER, instance.#getHandler())
    instance.#listen()
    return instance
  }
  resolveLifts() {
    // netEndurance hooks itself up here
    return this.#resolveLifts
  }
  async #listen() {
    for await (const request of this.#announcer.rxLifts()) {
      const { peerIdString, pulseLink, type } = request
      debug('lift from %s for %s of type %s', peerIdString, pulseLink, type)
      new Promise((resolve, reject) => {
        this.#resolveLifts.push({ pulseLink, type, resolve, reject })
      })
        .then(async (car) => {
          // make sure we have a connection to the peer
          const stream = await this.#ensureConnection(peerIdString)
          assert.strictEqual(typeof stream.push, 'function')
          stream.push(car)
        })
        .catch((error) => {
          // TODO send error back to announcer
          console.error(error)
        })
    }
    debug('rxLifts ended')
  }
  async #listenLifts(source) {
    pipe(source, lp.decode({ maxDataLength: Infinity }), async (source) => {
      let last = Date.now()
      for await (const chunk of source) {
        debug('got lift payload', chunk.length)
        const ms = Date.now() - last
        last = Date.now()
        if (chunk.length > 1e6) {
          console.error('got chunk of length', chunk.length, 'in', ms, 'ms')
        }
        const car = await CarReader.fromBytes(chunk.subarray())
        debug('got car')
        const [root, ...rest] = await car.getRoots()
        assert(rest.length === 0)
        const cidString = root.toString()
        const tracker = this.#promises.get(cidString)
        if (tracker) {
          tracker.resolve(car)
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
  async pullCar(pulseLink, type) {
    assert(pulseLink instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type])
    const cidString = pulseLink.cid.toString()
    if (this.#promises.has(cidString)) {
      return this.#promises.get(cidString).promise
    }
    let tracker
    const promise = new Promise((resolve, reject) => {
      tracker = { resolve, reject }
      // TODO get feedback from announcer
      try {
        this.#announcer.broadCastPullCar(pulseLink, type)
      } catch (error) {
        reject(error)
      }
    })
    tracker.promise = promise
    this.#promises.set(cidString, tracker)
    try {
      const car = await promise
      return car
    } finally {
      debug('promise finally %s', pulseLink)
      this.#promises.delete(cidString)
    }
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
    this.#listenLifts(stream.source)
    const push = pushable()
    pipe(push, lp.encode(), stream.sink)
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
