import assert from 'assert-fast'
import debug from 'debug'
import { RxRequest, RxReply, Pending } from '../../w015-models'

const raisePending = (pending, pendingRequest) => {
  assert(pending instanceof Pending)
  assert(pendingRequest instanceof RxRequest)
  assert(!pending.getIsPending())
  const raisedPending = Pending.clone({ ...pending, pendingRequest })
  return raisedPending
}
const bufferRequest = (pending, request) => {
  assert(pending instanceof Pending)
  assert(request instanceof RxRequest)
  assert(pending.getIsPending())
  let { bufferedRequests = [] } = pending
  bufferedRequests = [...bufferedRequests, request]
  return Pending.clone({ ...pending, bufferedRequests })
}
const pushReply = (pending, reply) => {
  assert(pending instanceof Pending)
  assert(reply instanceof RxReply)
  assert(pending.getIsPending())
  let accumulator = pending.getAccumulator()
  let bufferedReplies = pending.getBufferedReplies()
  let isSettlingReply = false
  accumulator = accumulator.map((tx) => {
    if (tx.to && tx.identifier === reply.identifier) {
      assert(!tx.reply)
      tx = { ...tx, reply }
      assert(!isSettlingReply)
      isSettlingReply = true
    }
    return tx
  })
  if (!isSettlingReply) {
    bufferedReplies = [...bufferedReplies, reply]
  }
  return Pending.clone({ ...pending, accumulator, bufferedReplies })
}
const settle = (pending) => {
  assert(pending instanceof Pending)
  assert(pending.getIsPending())
  pending = { ...pending }
  delete pending.pendingRequest
  delete pending.accumulator
  return Pending.clone(pending)
}
const shiftRequests = (pending) => {
  assert(pending instanceof Pending)
  assert(!pending.getIsPending())
  assert(!pending.accumulator)
  const rxRequest = pending.rxBufferedRequest()
  assert(rxRequest instanceof RxRequest)
  const [first, ...bufferedRequests] = pending.bufferedRequests
  assert(first.equals(rxRequest))
  const nextPending = { ...pending }
  if (!bufferedRequests.length) {
    delete nextPending.bufferedRequests
  }
  return Pending.clone(nextPending)
}

export { raisePending, bufferRequest, pushReply, settle, shiftRequests }
