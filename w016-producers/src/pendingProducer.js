const assert = require('assert')
const {
  rxRequestModel,
  rxReplyModel,
  pendingModel,
} = require('../../w015-models')

const raisePending = (pending, pendingRequest) => {
  assert(rxRequestModel.isModel(pendingRequest))
  assert(pendingModel.isModel(pending))
  assert(!pending.getIsPending())
  const raisedPending = pendingModel.clone({ ...pending, pendingRequest })
  return raisedPending
}
const bufferRequest = (pending, request) =>
  pendingModel.clone(pending, (draft) => {
    assert(rxRequestModel.isModel(request))
    assert(pending.getIsPending())
    const chainId = request.getAddress().getChainId()
    const index = request.getIndex()
    const indices = pending.requests[chainId] || []
    draft.requests[chainId] = [...indices, index]
  })
const pushReply = (pending, reply) =>
  pendingModel.clone(pending, (draft) => {
    assert(rxReplyModel.isModel(reply))
    assert(pending.getIsPending())
    draft.replies = [...pending.replies, reply]
  })
const settle = (pending) =>
  pendingModel.clone(pending, (draft) => {
    assert(pending.getIsPending())
    delete draft.pendingRequest
    draft.replies = []
  })
const shiftRequests = (pending, network) =>
  pendingModel.clone(pending, (draft) => {
    assert(!pending.getIsPending())
    assert(!pending.replies.length)
    const { event } = pending.rxBufferedRequest(network)
    assert(rxRequestModel.isModel(event))
    const chainId = event.getAddress().getChainId()
    const index = event.getIndex()
    const [first, ...rest] = pending.requests[chainId]
    assert.strictEqual(first, index)
    if (!rest.length) {
      delete draft.requests[chainId]
    } else {
      draft.requests[chainId] = rest
    }
  })

module.exports = {
  raisePending,
  bufferRequest,
  pushReply,
  settle,
  shiftRequests,
}
