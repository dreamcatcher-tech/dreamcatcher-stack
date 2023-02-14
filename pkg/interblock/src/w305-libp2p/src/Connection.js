import { pushable } from 'it-pushable'
import { fromString } from 'uint8arrays/from-string'
import { toString } from 'uint8arrays/to-string'
import { pipe } from 'it-pipe'
import assert from 'assert-fast'
import { Address, PulseLink } from '../../w008-ipld/index.mjs'
import Debug from 'debug'
const debug = Debug('interpulse:libp2p:Connection')

export class Connection {
  #latests = new Map()
  #tx
  #rx
  #announce
  #txSubscriptions = new Set() // chainId
  #rxSubscriptions = new Map() // chainId : isSingle
  #debounces = new Map() // chainId : {remote, local[]}
  static create(announce, latests) {
    assert.strictEqual(typeof announce.push, 'function')
    assert(latests instanceof Map)
    const instance = new Connection()
    instance.#tx = pushable({ objectMode: true })
    instance.#rx = pushable({ objectMode: true })
    instance.#announce = announce
    instance.#latests = latests
    instance.#listen()
    return instance
  }
  async #listen() {
    for await (const received of this.#rx) {
      debug(`received`, received)
      const { type, payload } = received
      const { chainId } = payload
      switch (type) {
        case 'ANNOUNCE': {
          const { pulselink, target } = payload
          const latest = PulseLink.parse(pulselink)
          const fromAddress = Address.fromChainId(chainId)
          const announcement = { fromAddress, latest }
          if (target) {
            const targetAddress = Address.parse(target)
            announcement.targetAddress = targetAddress
          }
          // TODO check this was a requested announcement
          // TODO update our tracker before announcing
          this.#announce.push(announcement)
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
            this.txAnnounce(forAddress, latest)
          }
          break
        }
        case 'UNSUBSCRIBE': {
          assert(this.#rxSubscriptions.has(chainId))
          this.#rxSubscriptions.delete(chainId)
          break
        }
      }
    }
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
    assert(!this.#txSubscriptions.has(chainId))
    const isSingle = false
    const subscribe = Connection.SUBSCRIBE(chainId, isSingle, proof)
    this.#txSubscriptions.add(chainId)
    this.#tx.push(subscribe)
  }
  txAnnounce(forAddress, pulselink, target) {
    assert(forAddress instanceof Address)
    assert(pulselink instanceof PulseLink)
    assert(!target || typeof target === 'string')
    const chainId = forAddress.getChainId()
    if (!this.#rxSubscriptions.has(chainId)) {
      return
    }
    const isSingle = this.#rxSubscriptions.get(chainId)
    if (isSingle) {
      this.#rxSubscriptions.delete(chainId)
    }
    const announce = Connection.ANNOUNCE(forAddress, pulselink, target)
    this.#tx.push(announce)
  }
  connectStream(stream) {
    assert(stream.sink)
    assert(stream.source)
    pipe(this.#tx, jsTransform, stream, sinkJs(this.#rx))
  }
  static SUBSCRIBE(chainId, isSingle = false, proof = []) {
    assert.strictEqual(typeof chainId, 'string')
    assert.strictEqual(typeof isSingle, 'boolean')
    assert(Array.isArray(proof))
    assert(proof.every((p) => p instanceof Address))
    const payload = { chainId, isSingle, proof }
    return { type: 'SUBSCRIBE', payload }
  }
  static ANNOUNCE(forAddress, pulselink, target) {
    assert(forAddress instanceof Address)
    assert(pulselink instanceof PulseLink)
    assert(!target || typeof target === 'string')
    const payload = {
      chainId: forAddress.getChainId(),
      pulselink: pulselink.cid.toString(),
    }
    if (target) {
      Address.parse(target)
      payload.target = target
    }
    return { type: 'ANNOUNCE', payload }
  }
}
async function* jsTransform(source) {
  for await (const object of source) {
    const arraylist = to(object)
    yield arraylist
  }
}
const to = (js) => {
  return fromString(JSON.stringify(js), 'utf8')
}
const sinkJs = (pushable) => {
  return async function (source) {
    try {
      for await (const arraylist of source) {
        const object = from(arraylist)
        pushable.push(object)
      }
    } catch (e) {
      // console.error(e)
      // TODO tear down the connection
    }
  }
}
const from = (arraylist) => {
  return JSON.parse(toString(arraylist.subarray(), 'utf8'))
}
