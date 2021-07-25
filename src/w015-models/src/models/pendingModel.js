const assert = require('assert')
const { standardize } = require('../modelUtils')
const { rxRequestModel, rxReplyModel } = require('../transients')
const { simpleArrayModel } = require('./simpleArrayModel')
const { networkModel } = require('./networkModel')
const { addressModel } = require('./addressModel')

const pendingModel = standardize({
  // TODO make model cleaner once util can handle OR in schemas
  schema: {
    title: 'Pending',
    description: `Indicates chain is waiting for a promise to resolve
    Stores the address and index of the request.
    Note that only requests can be origin actions for promises
    First request is the origin request
    The pendingRequest is saved in its entirety so structural changes
    can occur to networking and channels, and the request will still
    be able to proceed.`,
    type: 'object',
    required: ['replies', 'requests'],
    additionalProperties: false,
    properties: {
      pendingRequest: rxRequestModel.schema,
      replies: {
        type: 'array',
        description: `Full replies, allowing the originating request to be lowered,
        and the remote side to lower the reply, without losing it from the accumulator`,
        uniqueItems: true,
        items: rxReplyModel.schema,
      },
      requests: {
        type: 'object',
        additionalProperties: false,
        patternProperties: {
          '(.*?)': simpleArrayModel.schema, // TODO use chainId regex
        },
      },
    },
  },
  create() {
    return pendingModel.clone({ replies: [], requests: {} })
  },
  logicize(instance) {
    const { pendingRequest, replies, requests } = instance
    // TODO be able to get replies that came from requests after the trigger ?
    // but might be impossible as means order of ingestion now matters
    // TODO assert accumulator has no duplicate request items inside the replies
    if (!pendingRequest) {
      assert(!replies.length)
    }
    const getIsPending = () => !!pendingRequest
    const isBufferValid = (network) => {
      // TODO loop thru and ensure everything matches and is a promise

      return true
    }
    const getAccumulator = () => replies
    const rxBufferedRequest = (network) => {
      assert(networkModel.isModel(network))
      const chainIds = Object.keys(requests)
      if (!chainIds.length) {
        return
      }
      const chainId = chainIds[0]
      const address = addressModel.create(chainId)
      const alias = network.getAlias(address)
      assert(alias)
      const channel = network[alias]
      assert(channel)
      const index = requests[chainId][0]
      assert(index >= 0)
      const event = channel.rxRequest(index)
      assert(rxRequestModel.isModel(event))
      return { alias, event, channel }
    }
    const getIsBuffered = (request) => {
      assert(rxRequestModel.isModel(request))
      const chainId = request.getAddress().getChainId()
      const index = request.getIndex()
      if (!requests[chainId]) {
        return false
      }
      return requests[chainId].includes(index)
    }
    return {
      getIsPending,
      isBufferValid,
      getAccumulator,
      rxBufferedRequest,
      getIsBuffered,
    }
  },
})

module.exports = { pendingModel }
