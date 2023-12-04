import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import {
  Pulse,
  RxReply,
  AsyncRequest,
  Reply,
  Request,
  RxRequest,
  RequestId,
} from '.'
/**
 * Lifecycle increases thru five states:
 * 1. origin      - before any reduction has taken place
 * 2. reduced     - having txs with no requestIds attached
 * 3. transmitted - all txs have requestIds attached
 * 4. fulfilled   - all txs have been settled with replies
 * 5. settled     - the trail has replied to the origin
 * 
 * 
type RequestId struct {
    channelId Int
    stream String
    requestIndex Int
}
type AsyncRequest struct {
    request &Request
    to String
    requestId RequestId
    settled optional &Reply
}
type RxRequest struct {
    request &Request
    requestId RequestId
}
type AsyncTrail struct {
    origin RxRequest
    settles [AsyncRequest]
    txs [AsyncRequest]
    reply optional &reply
    openPaths optional [RequestId]
}
 */
export class AsyncTrail extends IpldStruct {
  origin
  settles = []
  txs = []
  static classMap = {
    origin: RxRequest,
    settles: AsyncRequest,
    txs: AsyncRequest,
    reply: Reply,
  }
  static createCI() {
    const requestId = RequestId.createCI()
    const request = Request.create('TEST')
    const rxRequest = RxRequest.create(request, requestId)
    return this.create(rxRequest)
  }
  static create(origin) {
    assert(origin instanceof RxRequest)
    return super.clone({ origin })
  }
  isSystem() {
    return this.origin.request.isSystem()
  }
  isSameOrigin(trail) {
    assert(trail instanceof AsyncTrail)
    return this.origin.requestId.equals(trail.origin.requestId)
  }
  isPending() {
    return !this.reply
  }
  assertLogic() {
    assert(!this.pulse)
    assert(this.settles.every((tx) => tx.isSettled()))
    assert(!this.reply, `can only crush promised trails`)
    if (this.txs) {
      this.#checkTxs(this.txs)
    }
  }
  isFulfilled() {
    return (
      !this.txs.length &&
      this.settles.every((tx) => tx.isSettled()) &&
      !this.openPaths
    )
  }
  isSettled() {
    return this.isFulfilled() && !this.isPending()
  }
  setTxs(txs) {
    this.#checkTxs(txs)
    return this.setMap({ txs })
  }
  #checkTxs(txs) {
    assert(Array.isArray(txs))
    assert(txs.every((tx) => tx instanceof AsyncRequest))
    if (txs.length) {
      assert(txs.some((tx) => !tx.isSettled() || tx.isRejection()))
    }
  }
  updateTxs(txs) {
    // TODO check requests match and only update requestIds
    assert.strictEqual(this.txs.length, txs.length)
    return this.setTxs(txs).#updateSettlement()
  }
  settleOrigin(reply) {
    assert(reply instanceof Reply)
    assert(!this.reply)
    return this.setMap({ reply })
  }
  hasTx(rxReply) {
    assert(rxReply instanceof RxReply)
    for (const tx of this.txs) {
      if (tx.isIdMatch(rxReply)) {
        return true
      }
    }
    const { openPaths = [] } = this
    for (const requestId of openPaths) {
      if (requestId.equals(rxReply.requestId)) {
        return true
      }
    }
    return false
  }
  settleTx(rxReply) {
    assert(rxReply instanceof RxReply)

    let { openPaths = [] } = this
    const { length } = openPaths
    openPaths = openPaths.filter((id) => !id.equals(rxReply.requestId))
    if (openPaths.length !== length) {
      assert.strictEqual(openPaths.length, length - 1)
      if (!openPaths.length) {
        return this.delete('openPaths')
      }
      return this.setMap({ openPaths })
    }

    let isMatched = false
    let txs = this.txs.map((tx) => {
      if (tx.isIdMatch(rxReply)) {
        isMatched = true
        return tx.settle(rxReply)
      }
      return tx
    })
    assert(isMatched, `no match found for ${rxReply.requestId}`)

    return this.setMap({ txs }).#updateSettlement()
  }
  #updateSettlement() {
    let { txs, settles } = this
    if (txs.every((tx) => tx.isSettled())) {
      settles = settles.concat(txs)
      txs = []
      return this.setMap({ txs, settles })
    }
    return this
  }
  getSettles() {
    return [...this.settles]
  }
  getRequestObject() {
    return this.origin.getRequestObject()
  }
  setError(txs, error) {
    const reply = Reply.createError(error)
    return this.setTxs(txs).settleOrigin(reply)
  }
  getError() {
    assert(this.reply)
    assert(this.reply.isRejection())
    return this.reply.getRejectionError()
  }
  result() {
    if (this.isPending()) {
      return
    }
    const { reply } = this
    if (reply.isResolve()) {
      return reply.payload
    } else {
      throw reply.getRejectionError()
    }
  }
  isOriginTrail() {
    return !this.settles.length
  }
  isPreviouslyPending() {
    // was this trail pending at one stage
    return this.settles.length
  }
  isTransmitted() {
    assert(!this.pulse)
    assert(this.settles.every((tx) => tx.isSettled()))
    return this.txs.every((tx) => !!tx.requestId)
  }
  getReply() {
    if (this.isPending()) {
      return Reply.createPromise()
    }
    return this.reply
  }
  getSettleReply() {
    assert(!this.isPending(), `not fulfilled`)
    assert(this.isPreviouslyPending(), `was never promised`)
    assert(this.reply)
    const { requestId } = this.origin
    const rxReply = RxReply.create(this.reply, requestId)
    return rxReply
  }
  awaitOpenPath(requestId) {
    assert(requestId instanceof RequestId)
    let { openPaths = [] } = this
    openPaths = [...openPaths, requestId]
    return this.setMap({ openPaths })
  }
}
