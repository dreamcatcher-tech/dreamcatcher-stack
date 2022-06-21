import assert from 'assert-fast'
import { Request, RequestId, Reply } from '.'
import { IpldStruct } from './IpldStruct'
import equals from 'fast-deep-equal'

/**
    type AsyncRequest struct {
        request &Request
        to String
        id RequestId
        settled optional &Reply
    }
*/
export class AsyncRequest extends IpldStruct {
  static create(request, to) {
    assert(request instanceof Request)
    assert.strictEqual(typeof to, 'string')
    assert(to)
    const instance = new AsyncRequest()
    instance.request = request
    instance.to = to
    return instance
  }
  setId(id) {
    assert(id instanceof RequestId)
    return this.setMap({ id })
  }
  settle(reply) {
    assert(reply instanceof Reply)
    assert(!this.isSettled())
    return this.setMap({ settled: reply })
  }
  isRequestMatch(request) {
    assert(request instanceof Request)
    return equals(this.request, request)
  }
  isSettled() {
    return this.settled !== undefined
  }
  assertLogic() {
    if (this.settled) {
      assert(this.id !== undefined, `cannot settle unidentified requests`)
    }
  }
}
