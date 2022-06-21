import assert from 'assert-fast'
import { Reply, AsyncRequest } from '../../w008-ipld'

export class Reduction {
  static createError(txs, error) {
    const reply = Reply.createError(error)
    return Reduction.createResolve(txs, reply)
  }
  static createPending(txs) {
    const reply = Reply.createPromise()
    return Reduction.createResolve(txs, reply)
  }
  static createResolve(txs, reply) {
    assert(Array.isArray(txs))
    assert(txs.every((tx) => tx instanceof AsyncRequest))
    assert(txs.every((tx) => !tx.isSettled()))
    assert(reply instanceof Reply)
    const instance = new Reduction()
    Object.assign(instance, { txs, reply })
    return instance
  }
  isPending() {
    assert(this.reply instanceof Reply)
    return this.reply.isPromise()
  }
  getError() {
    assert(this.reply)
    assert(this.reply.isRejection())
    return this.reply.getRejectionError()
  }
}
