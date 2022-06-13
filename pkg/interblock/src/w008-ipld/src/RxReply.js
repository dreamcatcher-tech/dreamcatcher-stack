import assert from 'assert-fast'
import { Reply, RequestId } from '.'
export class RxReply extends Reply {
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
}
