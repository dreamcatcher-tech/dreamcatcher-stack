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
import {
  RxReply,
  Reply,
  RxRequest,
  Request,
  RxQueue,
  PulseLink,
  Interpulse,
} from '.'
const STREAMS = { SYSTEM: 'system', REDUCER: 'reducer' }

export class Rx extends IpldStruct {
  static classMap = {
    tip: PulseLink, // TODO check pulselink is only used for tips
    system: RxQueue,
    reducer: RxQueue,
  }
  static cidLinks = []
  static create() {
    return super.clone({
      system: RxQueue.create(),
      reducer: RxQueue.create(),
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
      assert(this.isEmpty())
      assert(!tx.precedent)
    } else {
      if (!this.tip.cid.equals(tx.precedent.cid)) {
        throw new Error(`tip ${this.tip.cid} not precedent ${interpulse.cid}`)
      }
      // TODO retrieve the current tip
      // check that it comes next with the sequence numbers
      // ? may supply the previous tip to the function call
    }
    const system = this.system.ingestTxQueue(tx.system)
    const reducer = this.reducer.ingestTxQueue(tx.reducer)
    const tip = interpulse.getPulseLink()
    next = next.setMap({ tip, system, reducer })
    return next
  }
  shiftSystemReply() {
    const system = this.system.shiftReplies()
    return this.setMap({ system })
  }
  shiftSystemRequest() {
    const system = this.system.shiftRequests()
    return this.setMap({ system })
  }
  shiftReducerReply() {
    const reducer = this.reducer.shiftReplies()
    return this.setMap({ reducer })
  }
  shiftReducerRequest() {
    const reducer = this.reducer.shiftRequests()
    return this.setMap({ reducer })
  }
}
