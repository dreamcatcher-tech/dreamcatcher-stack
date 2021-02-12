const assert = require('assert')
const {
  channelModel,
  addressModel,
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  reductionModel,
  txRequestModel,
  pendingModel,
} = require('../../../w015-models')
const { networkProducer } = require('../../../w016-producers')
const { assign } = require('xstate')
const common = (debug) => {
  const reduceCovenant = async ({ dmz, covenantAction, isolatedTick }) => {
    // TODO test the actions are allowed actions using the ACL
    debug(`reduceCovenant: %o`, covenantAction.type)
    const isReply = rxReplyModel.isModel(covenantAction)
    const isRequest = rxRequestModel.isModel(covenantAction)
    assert(isReply || isRequest)

    const { state } = dmz
    const acc = dmz.pending.getAccumulator()
    const reduceResolve = await isolatedTick(state, covenantAction, acc)
    assert(reduceResolve, `Covenant returned: ${reduceResolve}`)
    debug(`reduceCovenant result pending: `, reduceResolve.isPending)
    return { reduceResolve }
  }
  const assignResolve = assign({
    reduceResolve: ({ dmz, anvil }, event) => {
      assert(dmzModel.isModel(dmz))
      const { reduceResolve } = event.data
      assert(reduceResolve)
      const { reduction, isPending, requests, replies } = reduceResolve
      debug(`assignResolve pending: %o`, isPending)
      return reductionModel.create(reduceResolve, anvil, dmz)
    },
  })
  const respondReply = assign({
    dmz: ({ dmz, address }) => {
      assert(dmzModel.isModel(dmz))
      const originalLoopback = dmz.network['.']
      assert(channelModel.isModel(originalLoopback))
      assert(addressModel.isModel(address))
      const alias = dmz.network.getAlias(address)
      debug('respondReply from: %o', alias)
      const network = networkProducer.respondReply(
        dmz.network,
        address,
        originalLoopback
      )
      return dmzModel.clone({ ...dmz, network })
    },
  })
  const assignRejection = assign({
    reduceRejection: ({ anvil }, event) => {
      if (rxReplyModel.isModel(anvil)) {
        // TODO do something with replies that cause rejections
      }
      return event.data
    },
  })
  const respondRejection = assign({
    // one of lifes great challenges
    dmz: ({ dmz, anvil, reduceRejection }) => {
      assert(dmzModel.isModel(dmz))
      const network = networkProducer.respondRejection(
        dmz.network,
        anvil,
        reduceRejection
      )
      return dmzModel.clone({ ...dmz, network })
    },
  })
  const transmit = assign({
    dmz: ({ dmz, reduceResolve }) => {
      assert(dmzModel.isModel(dmz))
      assert(reductionModel.isModel(reduceResolve))
      const { requests, replies } = reduceResolve
      debug('transmit req: %o rep %o', requests, replies)
      // TODO check if moving channels around inside dmz can affect tx ?
      // TODO deduplication before send, rather than relying on tx
      const network = networkProducer.tx(dmz.network, requests, replies)
      return dmzModel.clone({ ...dmz, network })
    },
    isExternalPromise: ({
      isExternalPromise,
      externalAction,
      reduceResolve,
    }) => {
      if (isExternalPromise) {
        return isExternalPromise
      }
      assert(reductionModel.isModel(reduceResolve))
      const { replies } = reduceResolve
      // TODO cleanup, since sometimes externalAction is an rxReply
      if (rxReplyModel.isModel(externalAction)) {
        debug(`transmit isExternalPromise`, false)
        return false
      }
      assert(rxRequestModel.isModel(externalAction))
      isExternalPromise = replies.some(
        (txReply) =>
          txReply.getReply().isPromise() &&
          txReply.request.sequence === externalAction.sequence
      )
      debug(`transmit isExternalPromise`, isExternalPromise)
      return isExternalPromise
    },
    isOriginPromise: ({ isOriginPromise, initialPending, reduceResolve }) => {
      // TODO when would this ever occur ?
      // TODO remove the origin promise each run to avoid this problem at all
      if (isOriginPromise || !initialPending.getIsPending()) {
        debug(`transmit isOriginPromise`, isOriginPromise)
        return isOriginPromise
      }
      assert(pendingModel.isModel(initialPending))
      assert(reductionModel.isModel(reduceResolve))
      const { replies } = reduceResolve
      const { pendingRequest } = initialPending
      isOriginPromise = replies.some(
        (txReply) =>
          txReply.getReply().isPromise() &&
          txReply.request.sequence === pendingRequest.sequence
      )
      debug(`transmit isOriginPromise`, isOriginPromise)
      return isOriginPromise
    },
  })
  const isReply = ({ anvil }) => {
    const isReply = rxReplyModel.isModel(anvil)
    if (!isReply) {
      assert(rxRequestModel.isModel(anvil))
    }
    debug(`isReply: %o`, isReply)
    return isReply
  }
  const respondLoopbackRequest = assign({
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
  })
  const isLoopbackResponseDone = ({ dmz, anvil }) => {
    assert(dmzModel.isModel(dmz))
    assert(rxRequestModel.isModel(anvil))
    assert(anvil.getAddress().isLoopback())

    const isDone = !!dmz.network.getResponse(anvil)
    debug(`isLoopbackResponseDone: %o anvil: %o`, isDone, anvil.type)
    return isDone
  }
  const mergeState = assign({
    dmz: ({ dmz, reduceResolve }) => {
      assert(dmzModel.isModel(dmz))
      assert(reductionModel.isModel(reduceResolve))
      debug(`mergeState`)
      return dmzModel.clone({ ...dmz, state: reduceResolve.reduction })
    },
  })
  const isAnvilNotLoopback = ({ anvil }) => {
    // non loopback anvil is the external action, and will be autoResolve'd
    assert(rxRequestModel.isModel(anvil))
    const isAnvilNotLoopback = !anvil.getAddress().isLoopback()
    debug(`isAnvilNotLoopback`, isAnvilNotLoopback)
    return isAnvilNotLoopback
  }
  return {
    respondRejection,
    assignRejection,
    isReply,
    transmit,
    respondReply,
    assignResolve,
    reduceCovenant,
    isLoopbackResponseDone,
    respondLoopbackRequest,
    mergeState,
    isAnvilNotLoopback,
  }
}
module.exports = { common }
