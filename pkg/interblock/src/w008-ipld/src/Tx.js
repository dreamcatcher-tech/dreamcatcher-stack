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
    address: CIDGenesis,
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
    address Address        # The remote chainId
    precedent optional &Pulse       # The last Pulse this chain sent
    system TxQueue         # System messages
    reducer TxQueue       # Covenant messages
  }
 */
export class Tx extends IpldStruct {
  static cidLinks = ['address', 'precedent']
  static classMap = {
    address: Address,
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
  txReducerReply(reply) {
    let reducer = this.reducer.txReply(reply)
    if (this.isLoopback()) {
      // TODO move to the loopback object
      // modify the requests start
      reducer = reducer.shiftRequestsStart()
    }
    return this.setMap({ reducer })
  }
  shiftReducerReplies() {
    assert(this.isLoopback())
    const reducer = this.reducer.shiftRepliesStart()
    return this.setMap({ reducer })
  }
  isEmpty() {
    return this.system.isEmpty() && this.reducer.isEmpty()
  }
  isGenesisRequest() {
    const request = this.system.rxRequest(0)
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
    const request = this.system.rxRequest(0)
    const { params } = request.payload

    const dmz = Dmz.create({ ...params, timestamp })
    const genesis = Provenance.createGenesis(dmz, validators)
    return await Pulse.create(genesis).crush()
  }
}
