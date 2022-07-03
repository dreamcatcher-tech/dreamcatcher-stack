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
    id RequestId
    reply optional &Reply
}
type RxRequest struct {
    request &Request
    requestId RequestId
}
type AsyncTrail struct {
    origin RxRequest
    settles [AsyncRequest]
    txs [AsyncRequest]
    rxReply optional &RxReply 
}
 */
export class AsyncTrail extends IpldStruct {
  settles = []
  txs = []
  static createCI() {
    const requestId = RequestId.createCI()
    const request = Request.create('TEST')
    const rxRequest = RxRequest.create(request, requestId)
    return this.create(rxRequest)
  }
  static create(origin) {
    assert(origin instanceof RxRequest)
    const instance = new this()
    Object.assign(instance, { origin })
    return instance
  }
  static createWithPulse(origin, pulse) {
    /** used when we need the response pattern, but want to make
     * one time only synchronized changes to a state variable.
     * If this mode is used, settles are disallowed, and txs
     * are disallowed, as the prescence of these items means
     * repeated execution will occur, which is counter to purpose
     * of this function.
     */
    assert(origin instanceof RxRequest)
    assert(pulse instanceof Pulse)
    return super.clone({ origin, pulse })
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
    assert(!this.txs.every((tx) => tx.isSettled()))
    assert(this.settles.every((tx) => tx.isSettled()))
    assert(!this.reply, `can only crush promised trails`)
  }
  isFulfilled() {
    // check that all settles are in fact settled
    return !this.txs.length && this.settles.every((s) => s.isSettled())
  }
  isSettled() {
    return this.isFulfilled() && !this.isPending()
  }
  setTxs(txs) {
    assert(Array.isArray(txs))
    assert(txs.every((tx) => tx instanceof AsyncRequest))
    assert(txs.every((tx) => !tx.isSettled()))
    return this.setMap({ txs })
  }
  updateTxs(txs) {
    // used for adding requestIds to txs
    assert(Array.isArray(txs))
    assert.strictEqual(this.txs.length, txs.length)
    if (!txs.length) {
      return this
    }
    // TODO check requests match
    return this.setTxs(txs)
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
    return false
  }
  settleTx(rxReply) {
    assert(rxReply instanceof RxReply)
    let isMatched = false
    let txs = this.txs.map((tx) => {
      if (tx.isIdMatch(rxReply)) {
        isMatched = true
        return tx.settle(rxReply)
      }
      return tx
    })
    assert(isMatched, `no match found for ${rxReply.requestId}`)
    let { settles } = this
    if (txs.every((tx) => tx.isSettled())) {
      settles = settles.concat(txs)
      txs = []
    }
    return this.setMap({ txs, settles })
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
}
