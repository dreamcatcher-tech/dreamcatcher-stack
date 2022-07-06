import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { Request, Reply } from '.'

export class PromisedReply extends IpldStruct {
  static create(requestIndex, reply) {
    assert(Number.isInteger(requestIndex))
    assert(requestIndex >= 0)
    assert(reply instanceof Reply)
    return super.clone({ requestIndex, reply })
  }
  static classMap = { reply: Reply }
}

/**

 */
export class TxQueue extends IpldStruct {
  static classMap = {
    requests: Request,
    replies: Reply,
    promisedReplies: PromisedReply,
  }
  static create() {
    return super.clone({
      requestsLength: 0,
      requests: [],
      repliesLength: 0,
      replies: [],
      promisedRequestIds: [],
      promisedReplies: [],
    })
  }
  assertLogic() {
    // TODO promiseRequestIds cannot be higher than highest replyId ?
  }
  txRequest(request) {
    assert(request instanceof Request)
    const requests = [...this.requests, request]
    const requestsLength = this.requestsLength + 1
    return this.setMap({ requests, requestsLength })
  }
  txReply(reply) {
    assert(reply instanceof Reply)
    const replies = [...this.replies, reply]
    const repliesLength = this.repliesLength + 1
    let { promisedRequestIds } = this
    if (reply.isPromise()) {
      const requestId = this.repliesLength
      promisedRequestIds = [...this.promisedRequestIds, requestId]
    }
    return this.setMap({ replies, repliesLength, promisedRequestIds })
  }
  settlePromise(reply, requestIndex) {
    assert(reply instanceof Reply)
    assert(!reply.isPromise())
    assert(Number.isInteger(requestIndex))
    assert(this.promisedRequestIds.includes(requestIndex))
    let { promisedRequestIds, promisedReplies, replies, repliesLength } = this
    promisedRequestIds = promisedRequestIds.filter((id) => id !== requestIndex)
    const isReplyTip = repliesLength - 1 === requestIndex
    const isReplyTipPresent = !!replies[0]
    if (isReplyTip && isReplyTipPresent) {
      // we are at tip, so directly resolve
      replies = [...replies]
      const promise = replies.pop()
      assert(promise.isPromise())
      replies.push(reply)
    } else {
      const promisedReply = PromisedReply.create(requestIndex, reply)
      promisedReplies = [...promisedReplies, promisedReply]
    }
    const next = { promisedRequestIds, promisedReplies, replies, repliesLength }
    return this.setMap(next)
  }
  isEmpty() {
    return (
      !this.requests.length &&
      !this.replies.length &&
      !this.promisedReplies.length
    )
  }
  isStart() {
    const isRequestsStart = this.requestsLength === this.requests.length
    const isRepliesStart = this.repliesLength === this.replies.length
    return (
      isRequestsStart &&
      isRepliesStart &&
      !this.promisedRequestIds.length &&
      !this.promisedReplies.length
    )
  }
  blank() {
    const promisedReplies = []
    const requests = []
    const replies = []
    return this.setMap({
      promisedReplies,
      requests,
      replies,
    })
  }
  hasReply(requestIndex) {
    return !!this.#getReply(requestIndex)
  }
  getReply(requestIndex) {
    const reply = this.#getReply(requestIndex)
    assert(reply)
    return reply
  }
  #getReply(requestIndex) {
    assert(Number.isInteger(requestIndex))
    assert(requestIndex >= 0)
    for (const promised of this.promisedReplies) {
      if (promised.requestIndex === requestIndex) {
        return promised.reply
      }
    }
    const index = requestIndex - (this.repliesLength - this.replies.length)
    const reply = this.replies[index]
    return reply
  }
}
