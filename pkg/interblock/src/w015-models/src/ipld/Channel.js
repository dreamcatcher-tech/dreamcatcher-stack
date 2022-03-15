import assert from 'assert-fast'
import { Address, Tx, Request } from '.'
import Debug from 'debug'
import { IpldStruct } from './IpldStruct'
import { deepFreeze } from './utils'
const debug = Debug('interblock:models:channel')

/**
 * ## Channel

`tip` matches up with precedent on the other side.

```sh
type RxTracker struct { # tracks what counters each ingestion is up to
    requestsTip Int
    repliesTip Int
}
type Channel struct {
    tip optional &Pulse          # The last Pulse this chain received
    system RxTracker
    reducer RxTracker
    tx &Tx
}
```
 */

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
    deepFreeze(this)
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

export class Channel extends IpldStruct {
  static classMap = { tx: Tx }
  static create(address = Address.createUnknown()) {
    assert(address instanceof Address)
    const tracker = new RxTracker()
    const tx = Tx.create(address)
    return super.clone({ rxSystem: tracker, rxReducer: tracker, tx })
  }
  static createRoot() {
    const root = Address.createRoot()
    return Channel.create(root)
  }
  static createLoopback() {
    const loopback = Address.createLoopback()
    return Channel.create(loopback)
  }
  isUnknown() {
    return this.tx.genesis.isUnknown()
  }
  assertLogic() {
    const { tip, rxSystem, rxReducer, tx } = this
    if (this.isUnknown()) {
      assert(rxSystem.isEmpty(), 'Replies to Unknown are impossible')
      assert(rxReducer.isEmpty(), 'Replies to Unknown are impossible')
      assert(!tip)
    }
    if (tip) {
      assert(!tx.isLoopback())
    }
  }
  txReducerRequest(request) {
    const tx = this.tx.txReducerRequest(request)
    return this.constructor.clone({ ...this, tx })
  }
  rxReducerRequest() {
    const { requestsTip } = this.rxReducer
    if (this.tx.isLoopback()) {
      assert(this.tx.reducer.requestsStart >= requestsTip)
      return this.tx.reducer.rxRequest(requestsTip)
    }
  }
  txReducerReply(reply) {
    const tx = this.tx.txReducerReply(reply)
    const rxReducer = this.rxReducer.incrementRequests()
    return this.constructor.clone({ ...this, tx, rxReducer })
  }
  rxReducerReply() {
    const { repliesTip } = this.rxReducer
    if (this.tx.isLoopback()) {
      assert(this.tx.reducer.repliesStart >= repliesTip)
      return this.tx.reducer.rxReply(repliesTip)
    }
  }
  shiftReducerReplies() {
    const tx = this.tx.shiftReducerReplies()
    const rxReducer = this.rxReducer.incrementReplies()
    return this.constructor.clone({ ...this, tx, rxReducer })
  }
}
