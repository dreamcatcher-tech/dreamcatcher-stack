import assert from 'assert-fast'
import { RequestId, RxReply, RxRequest, TxQueue } from '.'

export class RxQueue extends TxQueue {
  txRequest() {
    throw new Error('cannot tx in rx')
  }
  txReply() {
    throw new Error('cannot tx in rx')
  }
  blank() {
    throw new Error('cannot tx in rx')
  }
  settlePromise() {
    throw new Error('cannot tx in rx')
  }
  expandPiercings(q) {
    // takes in the current q where "this" is the piercings
    assert(q instanceof RxQueue)
    let { requests, requestsLength, replies, repliesLength } = this
    if (requestsLength !== q.requestsLength) {
      // TODO why not just set the whole thing every time ?
      const difference = q.requestsLength - requestsLength
      assert(difference >= 0)
      requestsLength = q.requestsLength
      const expansion = q.requests.slice(-1 * difference)
      requests = [...requests, ...expansion]
    }
    if (repliesLength !== q.repliesLength) {
      const difference = q.repliesLength - repliesLength
      assert(difference >= 0)
      repliesLength = q.repliesLength
      const expansion = q.replies.slice(-1 * difference)
      replies = [...replies, ...expansion]
    }
    // TODO pretty sure it is wrong to clobber like this ?
    const { promisedReplies, promisedRequestIds } = q
    return this.setMap({
      requests,
      requestsLength,
      replies,
      repliesLength,
      promisedRequestIds,
      promisedReplies,
    })
  }
  ingestTxQueue(q) {
    assert(q instanceof TxQueue)
    const priorRequestsLength = q.requestsLength - q.requests.length
    assert.strictEqual(priorRequestsLength, this.requestsLength)
    const priorRepliesLength = q.repliesLength - q.replies.length
    assert.strictEqual(priorRepliesLength, this.repliesLength)

    const { requestsLength, repliesLength } = q
    const requests = [...this.requests, ...q.requests]
    const replies = [...this.replies, ...q.replies]

    // TODO verify the logic of the replies accounting checks out
    let { promisedReplies } = this
    for (const promised of q.promisedReplies) {
      promisedReplies = [...promisedReplies, promised]
    }
    const { promisedRequestIds } = q
    return this.setMap({
      requests,
      requestsLength,
      replies,
      repliesLength,
      promisedReplies,
      promisedRequestIds,
    })
  }
  rxRequest(channelId, stream) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    if (this.requests.length) {
      const request = this.requests[0]
      const requestIndex = this.requestsLength - this.requests.length
      const requestId = RequestId.create(channelId, stream, requestIndex)
      return RxRequest.create(request, requestId)
    }
  }
  rxReply(channelId, stream) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    if (this.replies.length) {
      const reply = this.replies[0]
      const requestIndex = this.repliesLength - this.replies.length
      const requestId = RequestId.create(channelId, stream, requestIndex)
      return RxReply.create(reply, requestId)
    }
    if (this.promisedReplies.length) {
      // promises must be last, since don't know when they occured
      // and last is the only safe place to guarantee no request gets
      // resolved before it was made in the computation timeline
      const { requestIndex, reply } = this.promisedReplies[0]
      const requestId = RequestId.create(channelId, stream, requestIndex)
      return RxReply.create(reply, requestId)
    }
  }
  shiftRequests() {
    assert(this.requests.length)
    const [, ...requests] = this.requests
    return this.setMap({ requests })
  }
  shiftReplies() {
    if (this.replies.length) {
      const [, ...replies] = this.replies
      return this.setMap({ replies })
    }
    if (this.promisedReplies.length) {
      const [, ...promisedReplies] = this.promisedReplies
      return this.setMap({ promisedReplies })
    }
  }
}
