import assert from 'assert-fast'
import { Network, Channel, Request, Address } from '.'
import { RxRequest } from './RxRequest'

export class Io extends Channel {
  static create() {
    const address = Address.createIo()
    const io = super.create(Network.FIXED_IDS.IO, address)
    assert(io instanceof Io)
    return io
    // TODO block Io from being aliased
  }

  getTipRequest(request) {
    // rx the last added request, so can use to match up ids
    assert(request instanceof Request)
    const { channelId } = this
    const stream = request.isSystem() ? 'system' : 'reducer'
    assert(this.tx[stream].requests.length, `no tip found`)
    const requestIndex = this.tx[stream].requestsLength - 1
    assert.strictEqual(request, this.tx[stream].requests[requestIndex])
    return RxRequest.create(request, channelId, stream, requestIndex)
  }
}
