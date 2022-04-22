import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { Request, Reply } from '.'
/**
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
let blankTxQueue

/**
type TxQueue struct {
    requestsStart Int
    requests [&Request]
    repliesStart Int
    replies [&Reply]
    promisedIds [Int]
    promisedReplies [PromisedReply]
}
 */
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
    return this.setMap({ requests })
  }
  rxRequest(requestId) {
    assert(requestId >= this.requestsStart)
    const index = requestId - this.requestsStart
    assert(this.requests[index])
    return this.requests[index]
  }
  getRequestId() {
    assert(this.requests.length, `No requests to ID`)
    return this.requestsStart + this.requests.length - 1
  }
  txReply(reply) {
    assert(reply instanceof Reply)
    const replies = [...this.replies, reply]
    return this.setMap({ replies })
  }
  shiftRequestsStart() {
    assert(this.requests.length)
    const requestsStart = this.requestsStart + 1
    const [, ...requests] = this.requests
    return this.setMap({ requestsStart, requests })
  }
  rxReply(replyId) {
    assert(replyId >= this.repliesStart)
    return this.replies[replyId - this.repliesStart]
  }
  shiftRepliesStart() {
    assert(this.replies.length)
    const repliesStart = this.repliesStart + 1
    const [, ...replies] = this.replies
    return this.setMap({ repliesStart, replies })
  }
  isEmpty() {
    return (
      !this.requests.length &&
      !this.replies.length &&
      !this.promisedReplies.length
    )
  }
  isStart() {
    return (
      !this.requestsStart &&
      !this.repliesStart &&
      !this.replies.length &&
      !this.promisedIds.length &&
      !this.promisedReplies.length
    )
  }
  blank() {
    const promisedReplies = []
    const requests = []
    const requestsStart = this.requestsStart + this.requests.length
    const replies = []
    const repliesStart = this.repliesStart + this.replies.length
    return this.setMap({
      promisedReplies,
      requests,
      requestsStart,
      replies,
      repliesStart,
    })
  }
}
