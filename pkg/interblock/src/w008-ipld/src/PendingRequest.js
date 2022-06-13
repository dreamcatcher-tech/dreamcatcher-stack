import assert from 'assert-fast'
import { Request, RequestId, Reply } from '.'
import { IpldStruct } from './IpldStruct'
import equals from 'fast-deep-equal'

/**
    type PendingRequest struct {
        request &Request
        to String
        id RequestId
        settled optional &Reply
    }
*/
export class PendingRequest extends IpldStruct {
  static create(request, to) {
    assert(request instanceof Request)
    assert.strictEqual(typeof to, 'string')
    assert(to)
    const instance = new PendingRequest()
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
    return this.setMap({ settled: reply })
  }
  isRequestMatch(request) {
    assert(request instanceof Request)
    return equals(this.request, request)
  }
}
