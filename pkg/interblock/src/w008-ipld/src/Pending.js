import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'

export class Pending extends IpldStruct {
  assertLogic() {
    // TODO use references to interblocks to store buffered requests
    // and accumulations
    const { pendingRequest, accumulator = [] } = this
    if (!pendingRequest) {
      assert(!accumulator.length)
    }
  }
  getIsPending() {
    return !!this.pendingRequest
  }
}
