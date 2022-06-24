import assert from 'assert-fast'
import { Request, RequestId, RxReply, RxRequest } from '.'
import { IpldStruct } from './IpldStruct'
import equals from 'fast-deep-equal'

/**
    type AsyncRequest struct {
        request &Request
        to String
        id RequestId
        reply optional &Reply
    }
*/
export class AsyncRequest extends RxRequest {
  static create(request, to) {
    assert(request instanceof Request)
    assert.strictEqual(typeof to, 'string')
    assert(to)
    const instance = new AsyncRequest()
    instance.request = request
    instance.to = to
    return instance
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
  isSettled() {
    return this.settled !== undefined
  }
  assertLogic() {
    // cannot crush or uncrush with a RequestId
    assert(this.requestId instanceof RequestId)
  }
}
