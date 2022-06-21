import assert from 'assert-fast'
import { Reply, AsyncRequest, Pending } from '../../w008-ipld'

export class Reduction {
  static createError(error, state, txs) {
    assert(error instanceof Error)
    const reply = Reply.createError(error)
    return Reduction.createResolve(state, txs, reply)
  }
  static createPending(txs) {
    assert(Array.isArray(txs))
    assert(txs.every((tx) => tx instanceof AsyncRequest))
    const instance = new Reduction()
    Object.assign(instance, { txs })
    return instance
  }
  static createResolve(state, txs, reply) {
    const instance = new Reduction()
    if (state) {
      assert(state instanceof Object)
      Object.assign(instance, { state })
    }
    if (txs) {
      assert(Array.isArray(txs))
      assert(txs.every((tx) => tx instanceof AsyncRequest))
      Object.assign(instance, { txs })
    }
    if (reply) {
      assert(reply instanceof Reply)
      assert(reply.isResolve() || reply.isRejection())
      Object.assign(instance, { reply })
    }
    return instance
  }
  isPending() {
    return !this.reply && !this.state
  }
  generatePending(origin, settles) {
    assert(!this.isPending())
    return Pending.create(origin, settles, this.txs)
  }
  getError() {
    assert(this.reply)
    assert(this.reply.isRejection())
    return this.reply.getRejectionError()
  }
}
