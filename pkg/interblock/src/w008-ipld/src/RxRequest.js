import assert from 'assert-fast'
import { Request } from '.'
export class RxRequest extends Request {
  // same as request, but has id info attached so it can be replied to
  static create(request, channelId, stream, requestIndex) {
    assert(request instanceof Request)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    assert(Number.isInteger(requestIndex))
    assert(requestIndex >= 0)
    const instance = new RxRequest()
    Object.assign(instance, { ...request, channelId, stream, requestIndex })
    return instance
  }
  crush() {
    throw new Error(`Transients cannot be crushed`)
  }
}
