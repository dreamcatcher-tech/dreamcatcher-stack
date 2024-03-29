import assert from 'assert-fast'
import { Reply, Request, RequestId, RxReply, RxRequest } from '.'
import equals from 'fast-deep-equal'

/**
    type AsyncRequest struct {
        request &Request
        to String
        requestId optional RequestId
        settled optional &Reply
    }
*/
export class AsyncRequest extends RxRequest {
  static classMap = { request: Request, requestId: RequestId, settled: Reply }
  static create(request, to) {
    assert(request instanceof Request)
    assert.strictEqual(typeof to, 'string')
    assert(to)
    return super.clone({ request, to })
  }
  setId(requestId) {
    assert(requestId instanceof RequestId)
    return this.setMap({ requestId })
  }
  settle(rxReply) {
    assert(rxReply instanceof RxReply)
    assert(!this.isSettled())
    assert(this.isIdMatch(rxReply))
    const settled = rxReply.reply
    return this.setMap({ settled })
  }
  settleError(error) {
    assert(error instanceof Error)
    assert(!this.isSettled())
    const settled = Reply.createError(error)
    return this.setMap({ settled })
  }
  isRequestMatch(request) {
    assert(request instanceof Request)
    return equals(this.request, request)
  }
  isIdMatch(rxReply) {
    assert(rxReply instanceof RxReply)
    if (this.requestId) {
      return rxReply.requestId.equals(this.requestId)
    }
    return false
  }
  isRejection() {
    return this.settled && this.settled.isRejection()
  }
  isSettled() {
    return this.settled !== undefined
  }
  assertLogic() {
    // TODO replace all this with schema checks
    assert.strictEqual(typeof this.to, 'string')
    assert(this.to)
    assert(this.request instanceof Request)
    if (this.settled) {
      assert(this.settled instanceof Reply)
    }
  }
}
