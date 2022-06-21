import assert from 'assert-fast'
import { Request, RequestId } from '.'
import { deepFreeze } from './utils'
export class RxRequest extends Request {
  // same as request, but has id info attached so it can be replied to
  static create(request, requestId) {
    // TODO hold the original request too ?
    assert(request instanceof Request)
    assert(requestId instanceof RequestId)
    const instance = new RxRequest()
    Object.assign(instance, { request, requestId })
    return instance
  }
  crush() {
    throw new Error(`Transients cannot be crushed`)
  }
  getAction() {
    const { type, payload } = this
    const action = { type, payload }
    deepFreeze(action)
    return action
  }
}
