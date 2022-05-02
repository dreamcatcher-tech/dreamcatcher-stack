import assert from 'assert-fast'
import { RxReply, RxRequest, TxQueue } from '.'

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
  ingestTxQueue(q) {
    assert(q instanceof TxQueue)
    const priorRequestsLength = q.requestsLength - q.requests.length
    assert.strictEqual(priorRequestsLength, this.requestsLength)
    const priorRepliesLength = q.repliesLength - q.replies.length
    assert.strictEqual(priorRepliesLength, this.repliesLength)

    const requestsLength = this.requestsLength + q.requestsLength
    const requests = [...this.requests, ...q.requests]
    const repliesLength = this.repliesLength + q.repliesLength
    const replies = [...this.replies, ...q.replies]

    // TODO receive promise updates too
    return this.setMap({ requests, requestsLength, replies, repliesLength })
  }
  rxRequest(channelId, stream) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    if (this.requests.length) {
      const request = this.requests[0]
      const requestId = this.requestsLength - this.requests.length
      return RxRequest.create(request, channelId, stream, requestId)
    }
  }
  rxReply(channelId, stream) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    if (this.promisedReplies.length) {
      const { requestIndex, reply } = this.promisedReplies[0]
      return RxReply.create(reply, channelId, stream, requestIndex)
    } else if (this.replies.length) {
      const reply = this.replies[0]
      const requestId = this.repliesLength - this.replies.length
      return RxReply.create(reply, channelId, stream, requestId)
    }
  }
  shiftRequests() {
    assert(this.requests.length)
    const [, ...requests] = this.requests
    return this.setMap({ requests })
  }
  shiftReplies() {
    assert(this.replies.length)
    const [, ...replies] = this.replies
    return this.setMap({ replies })
  }
}
