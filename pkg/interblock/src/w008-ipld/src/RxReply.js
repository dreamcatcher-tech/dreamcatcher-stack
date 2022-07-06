import assert from 'assert-fast'
import { Reply, RequestId } from '.'
import { IpldStruct } from './IpldStruct'
export class RxReply extends IpldStruct {
  static create(reply, requestId) {
    assert(reply instanceof Reply)
    assert(requestId instanceof RequestId)
    return super.clone({ reply, requestId })
  }
  crush() {
    throw new Error(`Transients cannot be crushed`)
  }
  isPromise() {
    return this.reply.isPromise()
  }
  isResolve() {
    return this.reply.isResolve()
  }
  isRejection() {
    return this.reply.isRejection()
  }
  getRejectionError() {
    return this.reply.getRejectionError()
  }
}
