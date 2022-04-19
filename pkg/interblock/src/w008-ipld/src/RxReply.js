import assert from 'assert-fast'
import { Reply } from '.'
export class RxReply extends Reply {
  // same as reply but has id info in it so can retrieve the request
  // not sure why this is needed any more ?
  static create(reply, channelId, stream, index) {
    assert(reply instanceof Reply)
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    assert(Number.isInteger(index))
    assert(index >= 0)
    const instance = new RxReply()
    Object.assign(instance, { ...reply, channelId, stream, index })
    return instance
  }
  crush() {
    throw new Error(`Transients cannot be crushed`)
  }
}
