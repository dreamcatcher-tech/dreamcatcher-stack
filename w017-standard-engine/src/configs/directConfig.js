const assert = require('assert')
const debug = require('debug')('interblock:cfg:heart.direct')
const {
  txReplyModel,
  rxReplyModel,
  rxRequestModel,
  addressModel,
  dmzModel,
  channelModel,
  reductionModel,
  pendingModel,
} = require('../../../w015-models')
const { networkProducer, pendingProducer } = require('../../../w016-producers')
const { definition } = require('../machines/direct')
const { assign } = require('xstate')
const { common } = require('./common')
const {
  transmit,
  respondReply,
  assignResolve,
  reduceCovenant,
  respondRejection,
  assignRejection,
  isLoopbackResponseDone,
  respondLoopbackRequest,
  mergeState,
  isAnvilNotLoopback,
} = common(debug)
const config = {
  actions: {
    assignDirectCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        assert(!dmz.pending.getAccumulator().length)
        debug(`assignDirectCovenantAction`, anvil.type)
        return anvil
      },
    }),
    warnReplyRejection: ({ reduceRejection }) => {
      // TODO reject all loopback actions and reject the external action
      debug(`warnReplyRejection`)
      console.warn(`Warning: rejection occured during reply`)
      console.warn(reduceRejection)
    },
    raisePending: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        debug(`raisePending`, anvil.type)
        const pending = pendingProducer.raisePending(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    assignInitialPending: assign({
      initialPending: ({ dmz }) => {
        // TODO this probably breaks other things in weird undiscovered ways
        // as it isn't supposed to change during execution
        // but this handles if a promise raises and lowers in a single interpreter cycle
        assert(dmzModel.isModel(dmz))
        assert(dmz.pending.getIsPending())
        debug(`assignInitialPending`)
        return dmz.pending
      },
    }),
    promiseOriginRequest: assign({
      dmz: ({ dmz, anvil, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!covenantAction || anvil.equals(covenantAction))
        const { sequence } = anvil
        const promise = txReplyModel.create('@@PROMISE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [promise])
        debug(`promiseOriginRequest`, anvil.type)
        return dmzModel.clone({ ...dmz, network })
      },
      isExternalPromise: () => true,
    }),
    shiftBufferedRequest: assign({
      dmz: ({ dmz, covenantAction }) => {
        debug(`shiftBufferedRequest`, covenantAction.type)
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(covenantAction))
        assert(dmz.pending.getIsBuffered(covenantAction))
        const { alias, event, channel } = dmz.pending.rxBufferedRequest(
          dmz.network
        )
        assert(dmz.network[alias].equals(channel))
        assert(event.equals(covenantAction))
        const index = covenantAction.getIndex()
        assert(channel.replies[index].isPromise())
        const network = networkProducer.removeBufferPromise(
          dmz.network,
          covenantAction
        )
        const pending = pendingProducer.shiftRequests(dmz.pending, dmz.network)
        return dmzModel.clone({ ...dmz, pending, network })
      },
    }),
    assignResolve,
    transmit,
    mergeState,
    respondReply,
    assignRejection,
    respondRejection,
    respondLoopbackRequest,
  },
  guards: {
    isPending: ({ dmz }) => {
      const isPending = dmz.pending.getIsPending()
      debug(`isPending`, isPending)
      return isPending
    },
    isReductionPending: ({ reduceResolve }) => {
      assert(reductionModel.isModel(reduceResolve))
      const isReductionPending = reduceResolve.getIsPending()
      debug(`isReductionPending`, isReductionPending)
      return isReductionPending
    },
    isReply: ({ anvil }) => {
      const isReply = rxReplyModel.isModel(anvil)
      if (!isReply) {
        assert(rxRequestModel.isModel(anvil))
      }
      debug(`isReply: %o`, isReply)
      return isReply
    },
    isUnbufferedRequest: ({ dmz, covenantAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(covenantAction))
      assert(dmzModel.isModel(dmz))
      const { pending } = dmz
      const isUnbufferedRequest = !pending.getIsBuffered(covenantAction)
      debug(`isUnbufferedRequest`, isUnbufferedRequest)
      return isUnbufferedRequest
    },
    isAnvilNotLoopback,
    isLoopbackResponseDone,
  },
  services: {
    reduceCovenant,
  },
}

const directConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...definition, context }
  return { machine, config }
}

module.exports = { directConfig }
