/**
type RxTracker struct { # tracks what counters each ingestion is up to
    requestsTip Int
    repliesTip Int
}
type Rx struct {
    tip optional &Pulse          # The last Pulse this chain received
    system optional RxTracker
    reducer optional RxTracker
}
*/
import Immutable from 'immutable'
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import {
  RxReply,
  Reply,
  RxRequest,
  Request,
  TxQueue,
  PulseLink,
  Interpulse,
} from '.'
const STREAMS = { SYSTEM: 'system', REDUCER: 'reducer' }
class RxRemaining {
  constructor(requestsRemain = 0, repliesRemain = 0) {
    assert(Number.isInteger(requestsRemain), `requestsRemain not integer`)
    assert(Number.isInteger(repliesRemain), `repliesRemain not integer`)
    assert(requestsRemain >= 0, `requestsRemain: ${requestsRemain}`)
    assert(repliesRemain >= 0, `repliesRemain: ${repliesRemain}`)
    this.requestsRemain = requestsRemain
    this.repliesRemain = repliesRemain
  }
  isEmpty() {
    return this.requestsRemain === 0 && this.repliesRemain === 0
  }
  decrementRequests() {
    return new this.constructor(this.requestsRemain - 1, this.repliesRemain)
  }
  decrementReplies() {
    return new this.constructor(this.requestsRemain, this.repliesRemain - 1)
  }
  loopbackAddRequest() {
    return new this.constructor(this.requestsRemain + 1, this.repliesRemain)
  }
  loopbackAddReply() {
    return new this.constructor(this.requestsRemain, this.repliesRemain + 1)
  }
  ingestTxQueue(txQueue) {
    assert(txQueue instanceof TxQueue)
    const { requests, replies } = txQueue
    const requestsRemain = this.requestsRemain + requests.length
    const repliesRemain = this.repliesRemain + replies.length
    return new this.constructor(requestsRemain, repliesRemain)
  }
}
class TipCache {
  #resolver
  #tips = Immutable.Map()
  constructor(resolver) {
    this.#resolver = resolver
  }
  #clone() {
    const next = new this.constructor(this.#resolver)
    next.#tips = this.#tips
    return next
  }
  addTip(interpulse) {
    assert(interpulse instanceof Interpulse)
    const key = interpulse.cid.toString()
    const next = this.#clone()
    next.#tips = this.#tips.set(key, interpulse)
    return next
  }
  removeTip(interpulse) {
    assert(interpulse instanceof Interpulse)
    const key = interpulse.cid.toString()
    const next = this.#clone()
    next.#tips = this.#tips.delete(key)
    return next
  }
  async resolvePulseLink(pulseLink) {
    assert(pulseLink instanceof PulseLink)
    const key = pulseLink.cid.toString()
    if (!this.#tips.has(key)) {
      assert.strictEqual(typeof this.#resolver, 'function')
      const prior = await Interpulse.uncrush(pulseLink.cid, this.#resolver)
      this.#tips = this.#tips.set(key, prior)
    }
    return this.#tips.get(key)
  }
  async resolvePrecedent(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { precedent } = interpulse.tx
    return await this.resolvePulseLink(precedent)
  }
}
export class Rx extends IpldStruct {
  #tipCache = new TipCache()
  static classMap = {
    tip: PulseLink,
    system: RxRemaining,
    reducer: RxRemaining,
  }
  static cidLinks = []
  static create() {
    return super.clone({
      system: new RxRemaining(),
      reducer: new RxRemaining(),
    })
  }
  static async uncrush(rootCid, resolver, options) {
    const instance = await super.uncrush(rootCid, resolver, options)
    instance.#tipCache = new TipCache(resolver)
    return instance
  }
  clone() {
    const next = super.clone()
    next.#tipCache = this.#tipCache
    return next
  }
  isEmpty() {
    // empty means that both trackers both match the tip
    if (!this.tip) {
      assert(this.system.isEmpty())
      assert(this.reducer.isEmpty())
      return true
    }
    return this.system.isEmpty() && this.reducer.isEmpty()
  }
  addTip(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { tx } = interpulse
    let next = this
    if (!this.tip) {
      assert(this.system.isEmpty())
      assert(this.reducer.isEmpty())
      assert(!tx.precedent)
    } else {
      if (!this.tip.cid.equals(tx.precedent)) {
        throw new Error(`tip ${this.tip.cid} not precedent ${interpulse.cid}`)
      }
      // TODO retrieve the current tip
      // check that it comes next with the sequence numbers
    }
    const system = this.system.ingestTxQueue(tx.system)
    const reducer = this.reducer.ingestTxQueue(tx.reducer)
    const tip = interpulse.getPulseLink()
    next = next.setMap({ tip, system, reducer })
    next.#tipCache = next.#tipCache.addTip(interpulse)
    return next
  }
  // when shifting the counters, check if the tip should be ejected
  async rxSystemRequest(channelId) {
    const result = await this.#rx(STREAMS.SYSTEM, 'requests')
    if (!result) {
      return
    }
    const [request, index] = result
    assert(request instanceof Request)
    assert(Number.isInteger(index))
    assert(index >= 0)
    return RxRequest.create(request, channelId, STREAMS.SYSTEM, index)
  }
  async rxSystemReply(channelId) {
    const result = await this.#rx(STREAMS.SYSTEM, 'replies')
    if (!result) {
      return
    }
    const [reply, index] = result
    assert(reply instanceof Reply)
    assert(Number.isInteger(index))
    assert(index >= 0)
    return RxReply.create(reply, channelId, STREAMS.SYSTEM, index)
  }
  shiftSystemReply() {
    const system = this.system.decrementReplies()
    return this.setMap({ system })
  }
  shiftSystemRequest() {
    const system = this.system.decrementRequests()
    return this.setMap({ system })
  }
  shiftReducerReply() {
    const reducer = this.reducer.decrementReplies()
    return this.setMap({ reducer })
  }
  shiftReducerRequest() {
    const reducer = this.reducer.decrementRequests()
    return this.setMap({ reducer })
  }
  async rxReducerRequest(channelId) {
    const result = await this.#rx(STREAMS.SYSTEM, 'requests')
    if (!result) {
      return
    }
    const [request, index] = result
    assert(request instanceof Request)
    assert(Number.isInteger(index))
    assert(index >= 0)
    return RxRequest.create(request, channelId, STREAMS.SYSTEM, index)
  }

  async #rx(queueType, actionType) {
    assert(queueType === 'system' || queueType === 'reducer')
    assert(actionType === 'replies' || actionType === 'requests')
    const queue = this[queueType]
    let remain = queue[`${actionType}Remain`]
    assert(Number.isInteger(remain))
    assert(remain >= 0)
    if (!this.tip || !remain) {
      return
    }

    let index, array, interpulse
    do {
      if (!interpulse) {
        interpulse = await this.#tipCache.resolvePulseLink(this.tip)
      } else {
        interpulse = await this.#tipCache.resolvePrecedent(interpulse)
      }
      assert(interpulse instanceof Interpulse)
      array = interpulse.tx[queueType][actionType]
      index = array.length - remain
      remain -= array.length
    } while (index < 0)
    const action = array[index]
    return [action, index]
  }
}
