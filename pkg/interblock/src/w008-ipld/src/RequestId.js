import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class RequestId extends IpldStruct {
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
  toString() {}
}
