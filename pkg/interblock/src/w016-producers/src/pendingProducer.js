import assert from 'assert-fast'
import { RxRequest, RxReply, Pending, Accumulation } from '../../w015-models'

const raisePending = (pending, pendingRequest) => {
  assert(pending instanceof Pending)
  assert(pendingRequest instanceof RxRequest)
  assert(!pending.getIsPending())
  const raisedPending = pending.update({ pendingRequest })
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
  let { accumulator = [], bufferedReplies = [] } = pending
  let isSettlingReply = false
  accumulator = accumulator.map((tx) => {
    assert(tx instanceof Accumulation)
    if (tx.to && tx.identifier === reply.identifier) {
      assert(!tx.reply)
      tx = tx.update({ reply })
      assert(!isSettlingReply)
      isSettlingReply = true
    }
    return tx
  })
  if (!isSettlingReply) {
    bufferedReplies = [...bufferedReplies, reply]
  }
  return pending.update({ accumulator, bufferedReplies })
}
const settle = (pending) => {
  assert(pending instanceof Pending)
  assert(pending.getIsPending())
  pending = pending.delete('pendingRequest')
  pending = pending.delete('accumulator')
  return pending
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
