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
import { PulseLink, Pulse } from '.'

class RxTracker {
  requestsTip
  repliesTip
  constructor(requestsTip = 0, repliesTip = 0) {
    assert(Number.isInteger(requestsTip))
    assert(Number.isInteger(repliesTip))
    assert(requestsTip >= 0)
    assert(repliesTip >= 0)
    this.requestsTip = requestsTip
    this.repliesTip = repliesTip
  }
  isEmpty() {
    return this.requestsTip === 0 && this.repliesTip === 0
  }
  incrementRequests() {
    return new this.constructor(this.requestsTip + 1, this.repliesTip)
  }
  incrementReplies() {
    return new this.constructor(this.requestsTip, this.repliesTip + 1)
  }
}

export class Rx extends IpldStruct {
  static classMap = {
    tip: PulseLink,
    system: RxTracker,
    reducer: RxTracker,
  }
  static create() {
    return super.clone({
      system: new RxTracker(),
      reducer: new RxTracker(),
    })
  }
  isEmpty() {
    return this.system.isEmpty() && this.reducer.isEmpty()
  }
  addTip(pulse) {
    assert(pulse instanceof Pulse)
    if (!this.tip) {
      assert(this.system.isEmpty())
      assert(this.reducer.isEmpty())
    }
    // TODO
  }
}
