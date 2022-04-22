import assert from 'assert-fast'
import { Network, Channel, Address, Rx, Tx, RxRequest, RxReply } from '.'

/**
 *
 * ids have to match, just like every other channel
 *    but we can skip ahead and be permitted to join tip
 * later, can make an efficient loopback, but now we just rehash when it changes
 */
export class Loopback extends Channel {
  // flip the channel around so it can receive
  static create() {
    const address = Address.createLoopback()
    const rx = Rx.create()
    const tx = Tx.create()
    return super.clone({ address, rx, tx, aliases: [] })
  }
  // TODO reject any attempts to alias loopback
  txGenesis() {
    throw new Error('Loopback cannot birth children')
  }
  txRequest(request) {
    const next = super.txRequest(request)
    let { system, reducer } = next.rx
    if (request.isSystem()) {
      system = system.loopbackAddRequest()
    } else {
      reducer = reducer.loopbackAddRequest()
    }
    return next.setMap({ rx: { system, reducer } })
  }
  txReducerReply(reply) {
    const next = super.txReducerReply(reply)
    const reducer = next.rx.reducer.loopbackAddReply()
    const rx = next.rx.setMap({ reducer })

    const requestsStart = next.tx.reducer.requestsStart + 1
    const [, ...requests] = next.tx.reducer.requests
    const tx = next.tx.setMap({ reducer: { requestsStart, requests } })

    return next.setMap({ tx, rx })
  }
  txSystemReply(reply) {
    const next = super.txSystemReply(reply)
    const system = next.rx.system.loopbackAddReply()
    const rx = next.rx.setMap({ system })

    const requestsStart = next.tx.system.requestsStart + 1
    const [, ...requests] = next.tx.system.requests
    const tx = next.tx.setMap({ system: { requestsStart, requests } })

    return next.setMap({ tx, rx })
  }
  rxSystemRequest() {
    throw new Error('not implemented')
  }
  rxSystemReply() {
    throw new Error('not implemented')
  }
  rxReducerRequest(channelId) {
    // keep track of what number we are up to, since need to use this for ids
    // tx a reply shifts the request and updates the requestsStart counter
    // when shift the reply, shift the replies
    // can ignore the rx counters, as we pull from the front of the array every time
    assert.strictEqual(channelId, Network.FIXED_IDS.LOOPBACK)
    const { reducer } = this.tx
    const { requestsStart, requests } = reducer
    if (requests.length) {
      const index = requestsStart
      const [request] = requests
      return RxRequest.create(request, channelId, 'reducer', index)
    }
  }
  rxReducerReply(channelId) {
    assert.strictEqual(channelId, Network.FIXED_IDS.LOOPBACK)
    const { reducer } = this.tx
    const { repliesStart, replies } = reducer
    if (replies.length) {
      const index = repliesStart
      const [reply] = replies
      return RxReply.create(reply, channelId, 'reducer', index)
    }
  }
  shiftReducerReply() {
    const next = super.shiftReducerReply()
    const { reducer } = next.tx
    const repliesStart = reducer.repliesStart + 1
    const [, ...replies] = reducer.replies
    return next.setMap({ tx: { reducer: { repliesStart, replies } } })
  }
}
