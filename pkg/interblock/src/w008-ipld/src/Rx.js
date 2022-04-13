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

import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { TxQueue, PulseLink, Interpulse } from '.'

class RxRemaining {
  requestsRemain
  repliesRemain
  constructor(requestsRemain = 0, repliesRemain = 0) {
    assert(Number.isInteger(requestsRemain))
    assert(Number.isInteger(repliesRemain))
    assert(requestsRemain >= 0)
    assert(repliesRemain >= 0)
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
  addTip(txQueue) {
    assert(txQueue instanceof TxQueue)
    const { requests, replies } = txQueue
    const requestsRemain = this.requestsRemain + requests.length
    const repliesRemain = this.repliesRemain + replies.length
    return new this.constructor(requestsRemain, repliesRemain)
  }
}

export class Rx extends IpldStruct {
  static classMap = {
    tip: PulseLink,
    system: RxRemaining,
    reducer: RxRemaining,
  }
  static create() {
    return super.clone({
      system: new RxRemaining(),
      reducer: new RxRemaining(),
    })
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
    const system = this.system.addTip(tx.system)
    const reducer = this.reducer.addTip(tx.reducer)
    return next.setMap({ tip: interpulse, system, reducer })
  }
}
