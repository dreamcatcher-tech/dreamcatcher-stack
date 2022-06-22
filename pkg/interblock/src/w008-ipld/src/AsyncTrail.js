import assert from 'assert-fast'
import { IpldStruct } from './IpldStruct'
import { RxReply, AsyncRequest, Reply, Request, RxRequest, RequestId } from '.'
/**
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
    reply optional &Reply
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
  static createPending(txs) {
    const reply = Reply.createPromise()
    return this.createResolve(txs, reply)
  }
  static createResolve(txs, reply) {
    assert(Array.isArray(txs))
    assert(txs.every((tx) => tx instanceof AsyncRequest))
    assert(txs.every((tx) => !tx.isSettled()))
    assert(reply instanceof Reply)
    const instance = new this.constructor()
    Object.assign(instance, { txs, reply })
    return instance
  }
  isPending() {
    return !this.reply
  }
  assertLogic() {
    // cannot crush or uncrush if all asyncs are settled
    // cannot store with a reply object, since can only store promises
  }
  isFulfilled() {
    // check that all settles are in fact settled
    return !this.txs.length && this.settles.every((s) => s.isSettled())
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
    assert(this.txs.length)
    assert.strictEqual(this.txs.length, txs.length)
    // TODO check requests match
    return this.setTxs(txs)
  }
  settleOrigin(reply) {
    assert(reply instanceof Reply)
    assert(!this.reply)
    return this.setMap({ reply })
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
}
