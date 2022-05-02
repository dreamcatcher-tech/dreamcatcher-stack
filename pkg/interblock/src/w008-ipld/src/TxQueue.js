import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { Request, Reply } from '.'

export class PromisedReply extends IpldStruct {
  static create(requestIndex, reply) {
    assert(Number.isInteger(requestIndex))
    assert(requestIndex >= 0)
    assert(reply instanceof Reply)
    return super.create({ requestIndex, reply })
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
    // TODO promiseRequestIds cannot be higher than lowest replyId ?
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
    return this.setMap({ replies, repliesLength })
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
    const requestsLength = this.requestsLength + this.requests.length
    const replies = []
    const repliesLength = this.repliesLength + this.replies.length
    return this.setMap({
      promisedReplies,
      requests,
      requestsLength,
      replies,
      repliesLength,
    })
  }
}
