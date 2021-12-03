import { mixin } from './MapFactory'
import { Accumulation, RxReply, RxRequest } from '.'
import assert from 'assert-fast'
const schema = {
  // TODO make model cleaner once util can handle OR in schemas
  // TODO move to reference by blockheight and conflux count, not rx*
  // as rx* are meant to be transient models, not permanently stored.
  title: 'Pending',
  // description: `Indicates chain is waiting for a promise to resolve
  // Stores the address and index of the request.
  // Note that only requests can be origin actions for promises
  // First request is the origin request
  // The pendingRequest is saved in its entirety so structural changes
  // can occur to networking and channels, and the request will still
  // be able to proceed.`,
  type: 'object',
  required: [],
  additionalProperties: false,
  properties: {
    pendingRequest: RxRequest.schema,
    accumulator: {
      type: 'array',
      // description: `Full replies, in order, as well as request metadata
      items: Accumulation.schema,
    },
    bufferedReplies: {
      type: 'array',
      uniqueItems: true,
      items: RxReply.schema,
      // description: `when a reply is received from a request that
      // was earlier than the pending set of requests, we buffer it here`
    },
    bufferedRequests: {
      type: 'array',
      uniqueItems: true,
      items: RxRequest.schema,
      // description: `chainIds mapped to indexes of requests.
      // If channel is not there when comes to processing time, then the
      // request is ignored`,
    },
  },
}

export class Pending extends mixin(schema) {
  assertLogic() {
    // TODO use references to interblocks to store buffered requests
    // and accumulations
    const {
      pendingRequest,
      accumulator = [],
      bufferedReplies = [],
      bufferedRequests = [],
    } = this
    if (!pendingRequest) {
      assert(!accumulator.length)
    }
    for (const tx of accumulator) {
      if (tx.reply) {
        assert(tx.reply instanceof RxReply)
      }
    }
  }
  getIsPending() {
    return !!this.pendingRequest
  }
  rxBufferedRequest() {
    return this.bufferedRequests[0]
  }
  getIsBuffered(request) {
    assert(request instanceof RxRequest)
    return request.equals(this.bufferedRequests[0])
  }
}
