import { assert } from 'chai/index.mjs'
import { rxRequestModel, rxReplyModel, pendingModel } from '../../w015-models'

const raisePending = (pending, pendingRequest) => {
  assert(rxRequestModel.isModel(pendingRequest))
  assert(pendingModel.isModel(pending))
  assert(!pending.getIsPending())
  const raisedPending = pendingModel.clone({ ...pending, pendingRequest })
  return raisedPending
}
const bufferRequest = (pending, request) => {
  assert(rxRequestModel.isModel(request))
  assert(pending.getIsPending())
  const chainId = request.getAddress().getChainId()
  const index = request.getIndex()
  const requests = { ...pending.requests }
  const indices = pending.requests[chainId] || []
  requests[chainId] = [...indices, index]
  return pendingModel.clone({ ...pending, requests })
}
const pushReply = (pending, reply) => {
  assert(rxReplyModel.isModel(reply))
  assert(pending.getIsPending())
  const replies = [...pending.replies, reply]
  return pendingModel.clone({ ...pending, replies })
}
const settle = (pending) => {
  assert(pending.getIsPending())
  pending = { ...pending }
  delete pending.pendingRequest
  pending.replies = []
  return pendingModel.clone(pending)
}
const shiftRequests = (pending, network) => {
  assert(!pending.getIsPending())
  assert(!pending.replies.length)
  const { event } = pending.rxBufferedRequest(network)
  assert(rxRequestModel.isModel(event))
  const chainId = event.getAddress().getChainId()
  const index = event.getIndex()
  const [first, ...rest] = pending.requests[chainId]
  assert.strictEqual(first, index)
  const requests = { ...pending.requests }
  if (!rest.length) {
    delete requests[chainId]
  } else {
    requests[chainId] = rest
  }
  return pendingModel.clone({ ...pending, requests })
}

export { raisePending, bufferRequest, pushReply, settle, shiftRequests }