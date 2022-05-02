import assert from 'assert-fast'
import { Reply } from '.'
export class RxReply extends Reply {
  static create(reply, channelId, stream, requestIndex) {
    assert(reply instanceof Reply)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    assert(Number.isInteger(requestIndex))
    assert(requestIndex >= 0)
    const instance = new RxReply()
    Object.assign(instance, { ...reply, channelId, stream, requestIndex })
    return instance
  }
  crush() {
    throw new Error(`Transients cannot be crushed`)
  }
}
