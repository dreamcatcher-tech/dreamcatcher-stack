import assert from 'assert-fast'
import { Address, PulseLink } from '../../w008-ipld'
import Debug from 'debug'
const debug = Debug('interpulse:libp2p:Connection')

export class Connection {
  static #globalAnnounces = new Map()
  static updateGlobalAnnounces(forAddress, pulselink) {
    assert(forAddress instanceof Address)
    assert(pulselink instanceof PulseLink)
    const chainId = forAddress.getChainId()
    if (this.#globalAnnounces.has(chainId)) {
      const current = this.#globalAnnounces.get(chainId)
      if (pulselink.equals(current)) {
        return
      }
    }
    this.#globalAnnounces.set(chainId, pulselink)
  }
  #tx
  #rx
  #announce
  #txSubscriptions = new Set()
  #rxSubscriptions = new Map()
  // TODO ensure no echoes on the line
  #latests = new Map() // chainId : {remote, local[]}
  static create(tx, rx, announce) {
    assert.strictEqual(typeof announce.push, 'function')
    const instance = new Connection()
    instance.#tx = tx
    instance.#rx = rx
    instance.#announce = announce
    instance.#startListening()
    return instance
  }
  async #startListening() {
    for await (const { type, payload } of this.#rx) {
      debug(`received`, type)
      const { forAddress: chainId } = payload
      switch (type) {
        case 'ANNOUNCE': {
          const { pulselink: pulselinkString, path } = payload
          const pulselink = PulseLink.parse(pulselinkString)
          // TODO check this was a requested announcement
          // TODO update our tracker before announcing
          const forAddress = Address.fromChainId(chainId)
          this.#announce.push({ forAddress, pulselink })
          continue
        }
        case 'SUBSCRIBE': {
          const { isSingle } = payload
          assert(!this.#rxSubscriptions.has(chainId), `already subscribed`)
          this.#rxSubscriptions.set(chainId, isSingle)
          if (Connection.#globalAnnounces.has(chainId)) {
            // TODO handle path at a global level
            const latest = Connection.#globalAnnounces.get(chainId)
            assert(latest instanceof PulseLink)
            const forAddress = Address.fromChainId(chainId)
            this.txAnnounce(forAddress, latest)
          }
          continue
        }
        case 'UNSUBSCRIBE': {
          assert(this.#rxSubscriptions.has(chainId))
          this.#rxSubscriptions.delete(chainId)
          continue
        }
      }
    }
  }
  updateRxAnnounce(forAddress, pulselink) {
    // called from parent when another peer updates latest first
    assert(forAddress instanceof Address)
    assert(forAddress.isRemote())
    assert(pulselink instanceof PulseLink)
    const chainId = forAddress.getChainId()
    if (!this.#latests.has(chainId)) {
      this.#latests.set(chainId, { local: [] })
    }
    const tracker = this.#latests.get(chainId)
    if (tracker.remote === pulselink) {
      tracker.local = []
    } else {
      tracker.local.push(pulselink)
    }
  }
  isEmpty() {
    return !this.#txSubscriptions.size && !this.#rxSubscriptions.size
  }
  // stop repeats by updating all connections with latest
  txUnsubscribe(address) {
    assert(address instanceof Address)
    const chainId = address.getChainId()
    assert(this.#txSubscriptions.has(chainId))
    this.#txSubscriptions.delete(chainId)
  }
  txSubscribe(forAddress, proof = []) {
    assert(forAddress instanceof Address)
    assert(Array.isArray(proof))
    const isSingle = false
    const subscribe = Connection.SUBSCRIBE(forAddress, isSingle, proof)
    const chainId = forAddress.getChainId()
    assert(!this.#txSubscriptions.has(chainId))
    this.#txSubscriptions.add(chainId)
    this.#tx.push(subscribe)
  }
  txAnnounce(forAddress, pulselink, path = '') {
    assert(forAddress instanceof Address)
    assert(pulselink instanceof PulseLink)
    assert.strictEqual(typeof path, 'string')
    const chainId = forAddress.getChainId()
    Connection.updateGlobalAnnounces(forAddress, pulselink)
    if (!this.#rxSubscriptions.has(chainId)) {
      return
    }
    const isSingle = this.#rxSubscriptions.get(chainId)
    if (isSingle) {
      this.#rxSubscriptions.delete(chainId)
    }
    const announce = Connection.ANNOUNCE(forAddress, pulselink, path)
    this.#tx.push(announce)
  }
  static SUBSCRIBE(forAddress, isSingle = false, proof = []) {
    assert(forAddress instanceof Address)
    assert.strictEqual(typeof isSingle, 'boolean')
    assert(Array.isArray(proof))
    assert(proof.every((p) => p instanceof Address))
    const payload = { forAddress: forAddress.getChainId(), isSingle, proof }
    return { type: 'SUBSCRIBE', payload }
  }
  static ANNOUNCE(forAddress, pulselink, path) {
    assert(forAddress instanceof Address)
    assert(pulselink instanceof PulseLink)
    assert.strictEqual(typeof path, 'string')
    const payload = {
      forAddress: forAddress.getChainId(),
      pulselink: pulselink.cid.toString(),
      path,
    }
    return { type: 'ANNOUNCE', payload }
  }
}
