/**
 * type PromisedReply struct {
    requestIndex Int
    reply &Reply
}
type TxQueue struct {
    requestsLength Int
    requests optional [&Request]
    repliesLength Int
    replies optional [&Reply]
    promisedRequestIds [Int]
    promisedReplies optional [PromisedReply]
}
type RxQueue = TxQueue
type Rx struct {
    tip optional PulseLink          # The lastest known InterPulse
    latest optional PulseLink       # The latest known full Pulse
    system optional RxQueue
    reducer optional RxQueue
    isSubscription optional Bool    # notify the reducer when latest updates
}
*/
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { RxQueue, PulseLink, HistoricalPulseLink, Interpulse } from '.'

export class Rx extends IpldStruct {
  static cidLinks = ['tip', 'latest']
  static classMap = {
    tip: HistoricalPulseLink,
    system: RxQueue,
    reducer: RxQueue,
    latest: PulseLink,
  }
  static create() {
    return super.clone({
      system: RxQueue.create(),
      reducer: RxQueue.create(),
    })
  }
  isEmpty() {
    return this.system.isEmpty() && this.reducer.isEmpty()
  }
  isSettled() {
    return this.system.isSettled() && this.reducer.isSettled()
  }
  addTip(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { tx } = interpulse
    let next = this
    if (!this.tip) {
      assert(this.isEmpty())
      assert(!tx.precedent)
    } else {
      // TODO to lineage checks
      if (!this.tip.cid.equals(tx.precedent?.cid)) {
        throw new Error(`tip ${this.tip} not precedent: ${tx.precedent}`)
      }
    }
    const system = this.system.ingestTxQueue(tx.system)
    const reducer = this.reducer.ingestTxQueue(tx.reducer)
    const tip = interpulse.getHistoricalPulseLink()
    next = next.setMap({ tip, system, reducer })
    return next
  }
  addLatest(latest) {
    // TODO check this is genuinely the successor
    assert(latest instanceof PulseLink)
    assert(!latest.equals(this.latest))
    return this.setMap({ latest })
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
  get cid() {
    throw new Error('Rx cannot be crushed since it is schema identical to Tx')
  }
}
