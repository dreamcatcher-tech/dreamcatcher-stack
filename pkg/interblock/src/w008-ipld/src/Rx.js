/**
type RxTracker struct { # tracks what counters each ingestion is up to
    requestsTip Int
    repliesTip Int
}
type Rx struct {
    tip optional &Pulse          # The last Pulse this chain received
    system optional RxTracker
    reducer optional RxTracker
}
*/
import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import {
  RxReply,
  Reply,
  RxRequest,
  Request,
  TxQueue,
  PulseLink,
  Interpulse,
} from '.'
const STREAMS = { SYSTEM: 'system', REDUCER: 'reducer' }
class RxQueue extends TxQueue {
  txRequest() {
    throw new Error('cannot tx in rx')
  }
  txReply() {
    throw new Error('cannot tx in rx')
  }
  blank() {
    throw new Error('cannot tx in rx')
  }
  ingestTxQueue(q) {
    assert(q instanceof TxQueue)
    const priorRequestsLength = q.requestsLength - q.requests.length
    assert.strictEqual(priorRequestsLength, this.requestsLength)
    const priorRepliesLength = q.repliesLength - q.replies.length
    assert.strictEqual(priorRepliesLength, this.repliesLength)

    const requestsLength = this.requestsLength + q.requestsLength
    const requests = [...this.requests, ...q.requests]
    const repliesLength = this.repliesLength + q.repliesLength
    const replies = [...this.replies, ...q.replies]

    // TODO receive promise updates too
    return this.setMap({ requests, requestsLength, replies, repliesLength })
  }
  rxRequest(channelId, stream) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    if (this.requests.length) {
      const request = this.requests[0]
      const requestId = this.requestsLength - this.requests.length
      return RxRequest.create(request, channelId, stream, requestId)
    }
  }
  rxReply(channelId, stream) {
    assert(Number.isInteger(channelId))
    assert(channelId >= 0)
    assert(stream === 'system' || stream === 'reducer')
    if (this.promisedReplies.length) {
      const { requestIndex, reply } = this.promisedReplies[0]
      return RxReply.create(reply, channelId, stream, requestIndex)
    } else if (this.replies.length) {
      const reply = this.replies[0]
      const requestId = this.repliesLength - this.replies.length
      return RxReply.create(reply, channelId, stream, requestId)
    }
  }
  shiftRequests() {
    assert(this.requests.length)
    const requestsLength = this.requestsLength + 1
    const [, ...requests] = this.requests
    return this.setMap({ requestsLength, requests })
  }
  shiftReplies() {
    assert(this.replies.length)
    const repliesLength = this.repliesLength + 1
    const [, ...replies] = this.replies
    return this.setMap({ repliesLength, replies })
  }
}
export class Rx extends IpldStruct {
  static classMap = {
    tip: PulseLink, // TODO check pulselink is only used for tips
    system: RxQueue,
    reducer: RxQueue,
  }
  static cidLinks = []
  static create() {
    return super.clone({
      system: RxQueue.create(),
      reducer: RxQueue.create(),
    })
  }
  isEmpty() {
    // empty means that both trackers both match the tip
    if (!this.tip) {
      assert(this.system.isEmpty())
      assert(this.reducer.isEmpty())
      return true
    }
    return this.system.isEmpty() && this.reducer.isEmpty()
  }
  addTip(interpulse) {
    assert(interpulse instanceof Interpulse)
    const { tx } = interpulse
    let next = this
    if (!this.tip) {
      assert(this.isEmpty())
      assert(!tx.precedent)
    } else {
      if (!this.tip.cid.equals(tx.precedent)) {
        throw new Error(`tip ${this.tip.cid} not precedent ${interpulse.cid}`)
      }
      // TODO retrieve the current tip
      // check that it comes next with the sequence numbers
      // ? may supply the previous tip to the function call
    }
    const system = this.system.ingestTxQueue(tx.system)
    const reducer = this.reducer.ingestTxQueue(tx.reducer)
    const tip = interpulse.getPulseLink()
    next = next.setMap({ tip, system, reducer })
    return next
  }
  // when shifting the counters, check if the tip should be ejected
  rxSystemRequest(channelId) {
    const result = this.#rx(STREAMS.SYSTEM, 'requests')
    if (!result) {
      return
    }
    const [request, index] = result
    assert(request instanceof Request)
    assert(Number.isInteger(index))
    assert(index >= 0)
    return RxRequest.create(request, channelId, STREAMS.SYSTEM, index)
  }
  rxSystemReply(channelId) {
    const result = this.#rx(STREAMS.SYSTEM, 'replies')
    if (!result) {
      return
    }
    const [reply, index] = result
    assert(reply instanceof Reply)
    assert(Number.isInteger(index))
    assert(index >= 0)
    return RxReply.create(reply, channelId, STREAMS.SYSTEM, index)
  }
  shiftSystemReply() {
    const system = this.system.shiftReplies()
    return this.setMap({ system })
  }
  shiftSystemRequest() {
    const system = this.system.shiftRequests()
    return this.setMap({ system })
  }
  shiftReducerReply() {
    const reducer = this.reducer.shiftReplies()
    return this.setMap({ reducer })
  }
  shiftReducerRequest() {
    const reducer = this.reducer.shiftRequests()
    return this.setMap({ reducer })
  }
  rxReducerRequest(channelId) {
    const result = this.#rx(STREAMS.SYSTEM, 'requests')
    if (!result) {
      return
    }
    const [request, index] = result
    assert(request instanceof Request)
    assert(Number.isInteger(index))
    assert(index >= 0)
    return RxRequest.create(request, channelId, STREAMS.SYSTEM, index)
  }

  #rx(queueType, actionType) {
    assert(queueType === 'system' || queueType === 'reducer')
    assert(actionType === 'replies' || actionType === 'requests')
    const queue = this[queueType]
    let remain = queue[`${actionType}Remain`]
    assert(Number.isInteger(remain))
    assert(remain >= 0)
    if (!this.tip || !remain) {
      return
    }

    let index, array, interpulse
    const action = array[index]
    return [action, index]
  }
}
