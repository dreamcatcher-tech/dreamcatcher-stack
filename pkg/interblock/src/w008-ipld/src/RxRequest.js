import assert from 'assert-fast'
import { Request, RequestId } from '.'
import { deepFreeze } from './utils'
export class RxRequest extends Request {
  // same as request, but has id info attached so it can be replied to
  static classMap = { request: Request, requestId: RequestId }
  static create(request, requestId) {
    // TODO hold the original request too ?
    assert(request instanceof Request)
    assert(requestId instanceof RequestId)
    return super.clone({ request, requestId })
  }
  getRequestObject() {
    const { type, payload } = this.request
    const action = { type, payload }
    deepFreeze(action)
    return action
  }
}
