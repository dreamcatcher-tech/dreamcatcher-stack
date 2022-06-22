import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class RequestId extends IpldStruct {
  static createCI() {
    return this.create(0, 'reducer', 0)
  }
  static create(channelId, stream, requestIndex) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    assert(Number.isInteger(requestIndex))
    assert(requestIndex >= 0)
    const instance = new RequestId()
    instance.channelId = channelId
    instance.stream = stream
    instance.requestIndex = requestIndex
    return instance
  }
  equals(requestId) {
    assert(requestId instanceof RequestId)
    const { channelId: c1, stream: s1, requestIndex: i1 } = this
    const { channelId: c2, stream: s2, requestIndex: i2 } = requestId
    return c1 === c2 && s1 === s2 && i1 === i2
  }
  toString() {
    return `c${this.channelId}-${this.stream}-i${this.requestIndex}`
  }
}
