import { pushable } from 'it-pushable'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { pipe } from 'it-pipe'
import assert from 'assert-fast'
import { Address, Pulse, PulseLink } from '../../w008-ipld/index.mjs'
import { Lifter } from './Lifter'
import Debug from 'debug'
import posix from 'path-browserify'
const debug = Debug('interpulse:libp2p:Connection')

export class Connection {
  #peerIdString
  #latests = new Map()
  #tx
  #rx
  #update
  #announce
  #lift
  #txSubscriptions = new Set() // chainId
  #rxSubscriptions = new Map() // chainId : isSingle
  #debounces = new Map() // chainId : {remote, local[]}
  #stream
  // TODO merge all streams into one with action types
  static create(peerIdString, update, announce, lift, latests) {
    assert.strictEqual(typeof peerIdString, 'string')
    assert.strictEqual(typeof update.push, 'function')
    assert.strictEqual(typeof announce.push, 'function')
    assert.strictEqual(typeof lift.push, 'function')
    assert(latests instanceof Map)
    const instance = new Connection()
    instance.#peerIdString = peerIdString
    instance.#tx = pushable({ objectMode: true })
    instance.#rx = pushable({ objectMode: true })
    instance.#update = update
    instance.#announce = announce
    instance.#lift = lift
    instance.#latests = latests
    instance.#listen()
    return instance
  }
  stop(error) {
    this.#rx.return(error)
    this.#tx.return(error)
    if (this.#stream) {
      this.#stream.abort(error)
    }
  }
  async #listen() {
    for await (const received of this.#rx) {
      debug(`received`, received.type)
      const { type, payload } = received
      const { chainId } = payload
      switch (type) {
        case 'UPDATE': {
          const { pulselink } = payload
          const latest = PulseLink.parse(pulselink)
          const fromAddress = Address.fromChainId(chainId)
          const update = { fromAddress, latest }
          // TODO check this was a requested announcement
          // TODO update our tracker before announcing
          debug('update chainId %s pulseLink %s', fromAddress, latest)
          this.#update.push(update)
          break
        }
        case 'SUBSCRIBE': {
          const { isSingle } = payload
          assert(!this.#rxSubscriptions.has(chainId), `already subscribed`)
          this.#rxSubscriptions.set(chainId, isSingle)
          if (this.#latests.has(chainId)) {
            // TODO check permissions
            const latest = this.#latests.get(chainId)
            assert(latest instanceof PulseLink)
            const forAddress = Address.fromChainId(chainId)
            this.txUpdate(forAddress, latest)
          }
          break
        }
        case 'UNSUBSCRIBE': {
          assert(this.#rxSubscriptions.has(chainId))
          this.#rxSubscriptions.delete(chainId)
          break
        }
        case 'ANNOUNCE': {
          const { source, target, address, root, path } = payload
          const announcement = {
            source: PulseLink.parse(source),
            target: Address.fromChainId(target),
            address: Address.fromChainId(address),
            root: PulseLink.parse(root),
            path,
            peerIdString: this.#peerIdString,
          }
          debug('announce %o', announcement)
          this.#announce.push(announcement)
          break
        }
        case 'PULL': {
          const pulseLink = PulseLink.parse(payload.pulselink)
          const { type } = payload
          assert(Lifter.RECOVERY_TYPES[type])
          debug('pull %s type %s', pulseLink, type)
          this.#lift.push({ pulseLink, peerIdString: this.#peerIdString, type })
          break
        }
        default:
          throw new Error(`unknown type ${type}`)
      }
    }
    debug('rx ended')
  }
  updateRxAnnounce(forAddress, pulselink) {
    // called from parent when another peer updates latest first
    // used to muffle echos from helpful remote peers
    assert(forAddress instanceof Address)
    assert(forAddress.isRemote())
    assert(pulselink instanceof PulseLink)
    const chainId = forAddress.getChainId()
    if (!this.#debounces.has(chainId)) {
      this.#debounces.set(chainId, { local: [] })
    }
    const tracker = this.#debounces.get(chainId)
    if (tracker.remote === pulselink) {
      tracker.local = []
    } else {
      tracker.local.push(pulselink)
    }
  }
  txUnsubscribe(address) {
    assert(address instanceof Address)
    const chainId = address.getChainId()
    assert(this.#txSubscriptions.has(chainId))
    this.#txSubscriptions.delete(chainId)
  }
  txSubscribe(chainId, proof = []) {
    assert.strictEqual(typeof chainId, 'string')
    assert(Array.isArray(proof))
    if (this.#txSubscriptions.has(chainId)) {
      debug('already subscribed')
      return
    }
    const isSingle = false
    const subscribe = SUBSCRIBE(chainId, isSingle, proof)
    this.#txSubscriptions.add(chainId)
    this.#tx.push(subscribe)
  }
  txUpdate(forAddress, pulselink) {
    assert(forAddress instanceof Address)
    assert(pulselink instanceof PulseLink)
    const chainId = forAddress.getChainId()
    if (!this.#rxSubscriptions.has(chainId)) {
      return
    }
    const isSingle = this.#rxSubscriptions.get(chainId)
    if (isSingle) {
      this.#rxSubscriptions.delete(chainId)
    }
    const update = UPDATE(forAddress, pulselink)
    this.#tx.push(update)
  }
  txAnnounce(source, target, address, root, path) {
    const announce = ANNOUNCE(source, target, address, root, path)
    this.#tx.push(announce)
  }
  connectStream(stream, redial) {
    if (this.#stream) {
      console.error(stream)
      throw new Error(`already connected`)
    }
    assert(stream.sink)
    assert(stream.source)
    assert.strictEqual(typeof redial, 'function')
    this.#stream = stream
    pipe(this.#tx, jsTransform, stream, sinkJs(this.#rx, redial))
  }
  txPullCar(pulseLink, type) {
    assert(pulseLink instanceof PulseLink)
    assert(Lifter.RECOVERY_TYPES[type])
    const pull = PULL(pulseLink, type)
    this.#tx.push(pull)
  }
}
const sinkJs = (pushable, redial) => {
  return async function (source) {
    try {
      for await (const arraylist of source) {
        const object = from(arraylist)
        pushable.push(object)
      }
      debug('sinkJs ended')
    } catch (e) {
      // pushable.end(e)
      await Promise.resolve()
      redial()
    }
  }
}
function PULL(pulseLink, type) {
  assert(pulseLink instanceof PulseLink)
  assert(Lifter.RECOVERY_TYPES[type])
  const payload = { pulselink: pulseLink.cid.toString(), type }
  return { type: 'PULL', payload }
}
function SUBSCRIBE(chainId, isSingle = false, proof = []) {
  assert.strictEqual(typeof chainId, 'string')
  assert.strictEqual(typeof isSingle, 'boolean')
  assert(Array.isArray(proof))
  assert(proof.every((p) => p instanceof Address))
  const payload = { chainId, isSingle, proof }
  return { type: 'SUBSCRIBE', payload }
}
function UPDATE(forAddress, pulselink) {
  assert(forAddress instanceof Address)
  assert(pulselink instanceof PulseLink)
  const payload = {
    chainId: forAddress.getChainId(),
    pulselink: pulselink.cid.toString(),
  }
  return { type: 'UPDATE', payload }
}
function ANNOUNCE(source, target, address, root, path) {
  assert(source instanceof Pulse)
  assert(target instanceof Address)
  assert(address instanceof Address)
  assert(root instanceof PulseLink)
  assert(posix.isAbsolute(path))
  const payload = {
    source: source.cid.toString(),
    target: target.getChainId(),
    address: address.getChainId(),
    root: root.cid.toString(),
    path,
  }
  return { type: 'ANNOUNCE', payload }
}
async function* jsTransform(source) {
  for await (const object of source) {
    const arraylist = to(object)
    yield arraylist
  }
  debug('jsTransform ended')
}
const to = (js) => {
  return fromString(JSON.stringify(js), 'utf8')
}
const from = (arraylist) => {
  return JSON.parse(toString(arraylist.subarray(), 'utf8'))
}
