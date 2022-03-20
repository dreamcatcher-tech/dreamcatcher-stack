import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Pending extends IpldStruct {
  assertLogic() {
    // TODO use references to interblocks to store buffered requests
    // and accumulations
    const {
      pendingRequest,
      accumulator = [],
      bufferedReplies = [],
      bufferedRequests = [],
    } = this
    if (!pendingRequest) {
      assert(!accumulator.length)
    }
    for (const tx of accumulator) {
      if (tx.reply) {
        assert(tx.reply instanceof RxReply)
      }
    }
  }
  getIsPending() {
    return !!this.pendingRequest
  }
  rxBufferedRequest() {
    if (this.bufferedRequests) {
      return this.bufferedRequests[0]
    }
  }
  getIsBuffered(request) {
    assert(request instanceof RxRequest)
    return this.bufferedRequests && request.deepEquals(this.bufferedRequests[0])
  }
}
