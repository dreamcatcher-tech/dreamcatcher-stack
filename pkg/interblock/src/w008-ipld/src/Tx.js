import assert from 'assert-fast'
import { Address, Pulse, Reply, Request } from '.'
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

```sh
type PromisedReply struct {
    requestId Int
    reply &Reply
}

type Tx struct {
    address Address        # The remote chainId
    precedent &Pulse       # The last Pulse this chain sent
    system TxQueue         # System messages
    reducer TxQueue       # Covenant messages
}
```
 */
export class PromisedReply extends IpldStruct {
  static create(requestId, reply) {
    assert(Number.isInteger(requestId))
    assert(requestId >= 0)
    assert(reply instanceof Reply)
    return super.create({ requestId, reply })
  }
  static classMap = { reply: Reply }
}
/**
 * type TxQueue struct {
    requestsStart Int
    requests [&Request]
    repliesStart Int
    replies [&Reply]
    promisedIds [Int]
    promisedReplies [PromisedReply]
}
 */
let blankTxQueue
export class TxQueue extends IpldStruct {
  static classMap = {
    requests: Request,
    replies: Reply,
    promisedReplies: PromisedReply,
  }
  static create() {
    // always intended to start blank
    if (!blankTxQueue) {
      blankTxQueue = super.clone({
        requestsStart: 0,
        requests: [],
        repliesStart: 0,
        replies: [],
        promisedIds: [],
        promisedReplies: [],
      })
    }
    return blankTxQueue
  }
  txRequest(request) {
    assert(request instanceof Request)
    const requests = [...this.requests, request]
    return this.constructor.clone({ ...this, requests })
  }
  rxRequest(requestId) {
    assert(requestId >= this.requestsStart)
    return this.requests[requestId - this.requestsStart]
  }
  getRequestId() {
    assert(this.requests.length, `No requests to ID`)
    return this.requestsStart + this.requests.length - 1
  }
  txReply(reply) {
    assert(reply instanceof Reply)
    const replies = [...this.replies, reply]
    return this.constructor.clone({ ...this, replies })
  }
  shiftRequestsStart() {
    assert(this.requests.length)
    const requestsStart = this.requestsStart + 1
    const [, ...requests] = this.requests
    return this.constructor.clone({ ...this, requestsStart, requests })
  }
  rxReply(replyId) {
    assert(replyId >= this.repliesStart)
    return this.replies[replyId - this.repliesStart]
  }
  shiftRepliesStart() {
    assert(this.replies.length)
    const repliesStart = this.repliesStart + 1
    const [, ...replies] = this.replies
    return this.constructor.clone({ ...this, repliesStart, replies })
  }
}
/**
 * type Tx struct {
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
    precedent: Pulse,
    system: TxQueue,
    reducer: TxQueue,
  }
  static create(address) {
    assert(address instanceof Address)
    return super.clone({
      address,
      system: TxQueue.create(),
      reducer: TxQueue.create(),
    })
  }
  resolve(address) {
    assert(address instanceof Address)
    assert(address.isRemote(), `Address must be a remote address`)
    return this.constructor.clone({ ...this, address })
  }
  isLoopback() {
    return this.address.isLoopback()
  }
  assertLogic() {
    if (this.isLoopback()) {
      assert(!this.precedent)
      const banned = ['@@OPEN_CHILD']
      const systemRequests = this.system.requests
      assert(systemRequests.every(({ type }) => !banned.includes(type)))
    }
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
}
