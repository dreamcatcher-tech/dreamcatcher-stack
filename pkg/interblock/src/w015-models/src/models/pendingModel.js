import assert from 'assert-fast'
import { standardize } from '../modelUtils'
import { rxRequestModel, rxReplyModel } from '../transients'
import { accumulationModel } from './accumulationModel'

const pendingModel = standardize({
  // TODO make model cleaner once util can handle OR in schemas
  // TODO move to reference by blockheight and conflux count, not rx*
  // as rx* are meant to be transient models, not permanently stored.
  schema: {
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
      pendingRequest: rxRequestModel.schema,
      accumulator: {
        type: 'array',
        // description: `Full replies, in order, as well as request metadata
        items: accumulationModel.schema,
      },
      bufferedReplies: {
        type: 'array',
        uniqueItems: true,
        items: rxReplyModel.schema,
        // description: `when a reply is received from a request that
        // was earlier than the pending set of requests, we buffer it here`
      },
      bufferedRequests: {
        type: 'array',
        uniqueItems: true,
        items: rxRequestModel.schema,
        // description: `chainIds mapped to indexes of requests.
        // If channel is not there when comes to processing time, then the
        // request is ignored`,
      },
    },
  },
  create() {
    return pendingModel.clone({})
  },
  logicize(instance) {
    // TODO use references to interblocks to store buffered requests
    // and accumulations
    const {
      pendingRequest,
      accumulator = [],
      bufferedReplies = [],
      bufferedRequests = [],
    } = instance
    if (!pendingRequest) {
      assert(!accumulator.length)
    }
    for (const tx of accumulator) {
      if (tx.reply) {
        assert(rxReplyModel.isModel(tx.reply))
      }
    }
    const getIsPending = () => !!pendingRequest
    const getAccumulator = () => accumulator
    const getBufferedReplies = () => bufferedReplies
    const rxBufferedRequest = () => {
      return bufferedRequests[0]
    }
    const getIsBuffered = (request) => {
      assert(rxRequestModel.isModel(request))
      return request.equals(bufferedRequests[0])
    }
    return {
      getIsPending,
      getAccumulator,
      getBufferedReplies,
      rxBufferedRequest,
      getIsBuffered,
    }
  },
})

export { pendingModel }
