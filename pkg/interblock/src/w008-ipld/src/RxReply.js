import assert from 'assert-fast'
import { Reply, RequestId } from '.'
import { IpldStruct } from './IpldStruct'
export class RxReply extends IpldStruct {
  static create(reply, requestId) {
    assert(reply instanceof Reply)
    assert(requestId instanceof RequestId)
    const instance = new RxReply()
    Object.assign(instance, { reply, requestId })
    return instance
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
