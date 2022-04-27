import assert from 'assert-fast'
import { Network, Channel, Request, Tx } from '.'

export class Io extends Channel {
  static cidLinks = [...super.cidLinks, 'piercings']
  static classMap = { ...super.classMap, piercings: Tx }

  pierceRequest(request) {
    assert(request instanceof Request)
    let { piercings = Tx.create() } = this
    piercings = piercings.txRequest(request)

    let { system, reducer } = this.rx
    if (request.isSystem()) {
      system = system.loopbackAddRequest()
    } else {
      reducer = reducer.loopbackAddRequest()
    }
    return this.setMap({ piercings, rx: { system, reducer } })
  }
  getId(request) {
    assert(request instanceof Request)
    const channelId = Network.FIXED_IDS.IO
    const stream = request.isSystem() ? 'system' : 'reducer'
    const index = this.piercings ? this.piercings[stream].getRequestId() : 0
    return { channelId, stream, index }
  }
  rxSystemRequest(channelId) {
    assert.strictEqual(channelId, Network.FIXED_IDS.IO)
    // throw new Error('not implemented')
  }
  rxSystemReply(channelId) {
    assert.strictEqual(channelId, Network.FIXED_IDS.IO)
    const { system } = this.tx
    const { repliesStart, replies } = system
    if (replies.length) {
      throw new Error('not implemented')
      // const index = repliesStart
      // const [request] = requests
      // return RxRequest.create(request, channelId, 'reducer', index)
    }
  }
  rxReducerRequest(channelId) {
    assert.strictEqual(channelId, Network.FIXED_IDS.IO)
    if (!this.piercings) {
      return
    }
    const { reducer } = this.piercings
    const { requestsStart, requests } = reducer
    if (requests.length) {
      const index = requestsStart
      const [request] = requests
      return RxRequest.create(request, channelId, 'reducer', index)
    }
    throw new Error('not implemented')
  }
  rxReducerReply(channelId) {
    assert.strictEqual(channelId, Network.FIXED_IDS.IO)
    const { system } = this.tx 
    const { repliesStart, replies } = system
    if (replies.length) {
      throw new Error('not implemented')
      // const index = repliesStart
      // const [request] = requests
      // return RxRequest.create(request, channelId, 'reducer', index)
    }

    // throw new Error('not implemented')
  }
  rxIsEmpty() {
    return this.rx.system.isEmpty() && this.rx.reducer.isEmpty()
  }
}
