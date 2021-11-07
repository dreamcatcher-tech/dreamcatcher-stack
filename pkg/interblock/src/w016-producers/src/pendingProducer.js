import assert from 'assert-fast'
import debug from 'debug'
import {
  rxRequestModel,
  rxReplyModel,
  pendingModel,
  networkModel,
} from '../../w015-models'

const raisePending = (pending, pendingRequest) => {
  assert(pendingModel.isModel(pending))
  assert(rxRequestModel.isModel(pendingRequest))
  assert(!pending.getIsPending())
  const raisedPending = pendingModel.clone({ ...pending, pendingRequest })
  return raisedPending
}
const bufferRequest = (pending, request) => {
  assert(pendingModel.isModel(pending))
  assert(rxRequestModel.isModel(request))
  assert(pending.getIsPending())
  let { bufferedRequests = [] } = pending
  bufferedRequests = [...bufferedRequests, request]
  return pendingModel.clone({ ...pending, bufferedRequests })
}
const pushReply = (pending, reply) => {
  assert(pendingModel.isModel(pending))
  assert(rxReplyModel.isModel(reply))
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
  return pendingModel.clone({ ...pending, accumulator, bufferedReplies })
}
const settle = (pending) => {
  assert(pendingModel.isModel(pending))
  assert(pending.getIsPending())
  pending = { ...pending }
  delete pending.pendingRequest
  delete pending.accumulator
  return pendingModel.clone(pending)
}
const shiftRequests = (pending) => {
  assert(pendingModel.isModel(pending))
  assert(!pending.getIsPending())
  assert(!pending.accumulator)
  const rxRequest = pending.rxBufferedRequest()
  assert(rxRequestModel.isModel(rxRequest))
  const [first, ...bufferedRequests] = pending.bufferedRequests
  assert(first.equals(rxRequest))
  const nextPending = { ...pending }
  if (!bufferedRequests.length) {
    delete nextPending.bufferedRequests
  }
  return pendingModel.clone(nextPending)
}

export { raisePending, bufferRequest, pushReply, settle, shiftRequests }
