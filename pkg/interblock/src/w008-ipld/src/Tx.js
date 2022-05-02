import assert from 'assert-fast'
import {
  TxQueue,
  Dmz,
  Provenance,
  Pulse,
  Address,
  PulseLink,
  Request,
  Validators,
  Timestamp,
} from '.'
import { IpldStruct } from './IpldStruct'
/**
 * ## Tx

A transmission that is destined for some chainId, which might be as yet unresolved.  
At the start of each block, all transmitting channels are zeroed and the precedent is updated. Validators may coordinate transmission workloads by sharing the pooled softblock where they each zero out channels as they get sent, to ensure all interblocks are sent, and to parallelize the work.

```js
const TxExample = {
    precedent: CIDPrecedent,
    system: {
        requestsStart: 23423,
        requests: [action1, action2, action3],
        repliesStart: 3324,
        replies: [reply1, reply2, reply3, reply4]
        promisedIds: [ 32, 434, 435 ],
        promisedReplies: [
            { requestId: 12, reply: reply5 },
            { requestId: 9, reply: reply6 }
        ]
    },
    covenant: {
        requestsStart: 84587,
        requests: [],
        repliesStart: 868594,
        replies: [reply1]
        promisedIds: [ 3, 562, 9923 ],
        promisedReplies: []
    }
}
```


type Tx struct {
    precedent optional &Pulse       # The last Pulse this chain sent
    system TxQueue         # System messages
    reducer TxQueue       # Covenant messages
  }
 */
export class Tx extends IpldStruct {
  static cidLinks = ['address', 'precedent']
  static classMap = {
    precedent: PulseLink,
    system: TxQueue,
    reducer: TxQueue,
  }
  static create() {
    return super.clone({
      system: TxQueue.create(),
      reducer: TxQueue.create(),
    })
  }
  assertLogic() {
    // TODO all promise indices have to be less than the repliesStart counter
  }
  txRequest(request) {
    assert(request instanceof Request)
    let { reducer, system } = this
    if (request.isSystem()) {
      system = system.txRequest(request)
    } else {
      reducer = reducer.txRequest(request)
    }
    return this.setMap({ reducer, system })
  }
  txSystemReply(reply) {
    const system = this.system.txReply(reply)
    return this.setMap({ system })
  }
  txReducerReply(reply) {
    const reducer = this.reducer.txReply(reply)
    return this.setMap({ reducer })
  }
  isEmpty() {
    return this.system.isEmpty() && this.reducer.isEmpty()
  }
  isGenesisRequest() {
    const request = this.system.requests[0]
    const isGenesis =
      request && request.type === '@@GENESIS' && request.payload.params
    return (
      isGenesis &&
      !this.precedent &&
      this.system.isStart() &&
      this.reducer.isStart()
    )
  }
  async extractChildGenesis(validators, timestamp) {
    assert(validators instanceof Validators)
    assert(timestamp instanceof Timestamp)
    assert(this.isGenesisRequest())
    const request = this.system.requests[0]
    const { params } = request.payload

    const dmz = Dmz.create({ ...params, timestamp })
    const genesis = Provenance.createGenesis(dmz, validators)
    return await Pulse.create(genesis)
  }
  blank(precedent) {
    assert(!this.isEmpty())
    assert(precedent instanceof PulseLink)
    // TODO check precedent is not the same as the current one
    // unless loopback or io
    return this.setMap({
      precedent,
      system: this.system.blank(),
      reducer: this.reducer.blank(),
    })
  }
}
