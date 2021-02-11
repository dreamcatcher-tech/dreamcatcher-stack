const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter.direct')
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
const {
  transmit,
  respondReply,
  assignResolve,
  reduceCovenant,
  respondRejection,
  assignRejection,
} = require('./interpreterCommonConfigs')
const config = {
  actions: {
    assignDirectCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        assert(!dmz.pending.getAccumulator().length)
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
    mergeState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug(`mergeState`)
        return dmzModel.clone({ ...dmz, state: reduceResolve.reduction })
      },
    }),
    respondRequest: assign({
      dmz: ({ initialPending, externalAction, dmz, address, anvil }) => {
        debug('respondRequest')
        assert(pendingModel.isModel(initialPending))
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(anvil.getAddress().equals(address))
        const isFromBuffer = initialPending.getIsBuffered(anvil)
        const msg = `externalAction can only be responded to by auto resolvers`
        assert(!anvil.equals(externalAction) || isFromBuffer, msg)
        const network = networkProducer.respondRequest(dmz.network, anvil)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    shiftBufferedRequest: assign({
      dmz: ({ dmz, covenantAction }) => {
        debug(`shiftBufferedRequest`)
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(covenantAction))
        assert(dmz.pending.getIsBuffered(covenantAction))
        const { alias, event, channel } = dmz.pending.rxBufferedRequest(
          dmz.network
        )
        assert(dmz.network[alias].equals(channel))
        assert(event.equals(covenantAction))
        const index = covenantAction.getIndex()
        if (!channel.replies[index].isPromise()) {
          debugger
        }
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
    respondReply,
    assignRejection,
    respondRejection,
  },
  guards: {
    isExternalAction: ({ externalAction, anvil, address }) => {
      // a non loopback external action will be responded to by autoresolvers
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      assert(addressModel.isModel(address))
      const isExternalAction = !address.isLoopback()
      assert(!isExternalAction || externalAction.equals(anvil))
      debug(`isExternalAction`, isExternalAction)
      return isExternalAction
    },
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
    isUnbuffered: ({ dmz, covenantAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(covenantAction))
      assert(dmzModel.isModel(dmz))
      const { pending } = dmz
      const isUnbuffered = !pending.getIsBuffered(covenantAction)
      debug(`isUnbuffered`, isUnbuffered)
      return isUnbuffered
    },
    isLoopbackResponseDone: ({ dmz, anvil, address }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      assert(anvil.getAddress().equals(address))
      assert(address.isLoopback())

      const isDone = !!dmz.network.getResponse(anvil)
      debug(`isLoopbackResponseDone: %o anvil: %o`, isDone, anvil.type)
      return isDone
    },
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
