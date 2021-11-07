import assert from 'assert-fast'
import {
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  reductionModel,
  pendingModel,
} from '../../../w015-models'
import { networkProducer, dmzProducer } from '../../../w016-producers'
import { assign } from 'xstate'
const common = (debug) => {
  const reduceCovenant = async ({ dmz, covenantAction, isolatedTick }) => {
    // TODO test the actions are allowed actions using the ACL
    assert(dmzModel.isModel(dmz))
    const replyKey = covenantAction.getReplyKey()
    debug(`reduceCovenant: %o`, covenantAction.type, replyKey)
    const isReply = rxReplyModel.isModel(covenantAction)
    const isRequest = rxRequestModel.isModel(covenantAction)
    assert(isReply || isRequest)

    const { state, pending } = dmz
    const accumulator = pending.getAccumulator()
    const reduceResolve = await isolatedTick(state, covenantAction, accumulator)
    assert(reduceResolve, `Covenant returned: ${reduceResolve}`)
    debug(`reduceCovenant result pending: `, reduceResolve.isPending)
    return { reduceResolve }
  }
  const assignResolve = assign({
    reduceResolve: ({ dmz, anvil }, event) => {
      assert(dmzModel.isModel(dmz))
      const { reduceResolve } = event.data
      assert(reduceResolve)
      debug(`assignResolve pending: %o`, reduceResolve.isPending)
      return reductionModel.create(reduceResolve, anvil, dmz)
    },
  })
  const assignRejection = assign({
    reduceRejection: ({ anvil }, event) => {
      if (rxReplyModel.isModel(anvil)) {
        // TODO do something with replies that cause rejections
      }
      if (event.data.name === 'AssertionError') {
        if (event.data.actual === undefined) {
          event.data.actual = null
        }
      }
      // console.error(event.data)
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
      const { transmissions } = reduceResolve
      debug('transmit transmissions.length: %o', transmissions.length)
      // TODO check if moving channels around inside dmz can affect tx ?
      const network = networkProducer.tx(dmz.network, transmissions)
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
      const replies = reduceResolve.getReplies()
      // TODO cleanup, since sometimes externalAction is an rxReply
      if (rxReplyModel.isModel(externalAction)) {
        debug(`transmit isExternalPromise`, false)
        return false
      }
      assert(rxRequestModel.isModel(externalAction))
      isExternalPromise = replies.some(
        (txReply) =>
          txReply.getReply().isPromise() &&
          txReply.identifier === externalAction.identifier
      )
      debug(`transmit isExternalPromise`, isExternalPromise)
      return isExternalPromise
    },
    isOriginPromise: ({ isOriginPromise, initialPending, reduceResolve }) => {
      // TODO when would this ever occur ?
      // if only allow interchain hooked functions, then cannot origin promise
      // TODO remove the origin promise each run to avoid this problem at all
      if (isOriginPromise || !initialPending.getIsPending()) {
        debug(`transmit isOriginPromise`, isOriginPromise)
        return isOriginPromise
      }
      assert(pendingModel.isModel(initialPending))
      assert(reductionModel.isModel(reduceResolve))
      const replies = reduceResolve.getReplies()
      const { pendingRequest } = initialPending
      isOriginPromise = replies.some(
        (txReply) =>
          txReply.getReply().isPromise() &&
          txReply.identifier === pendingRequest.identifier
      )
      debug(`transmit isOriginPromise`, isOriginPromise)
      return isOriginPromise
    },
  })
  const assignReplayIdentifiers = assign({
    dmz: ({ reduceResolve, dmz }) => {
      assert(reductionModel.isModel(reduceResolve))
      assert(dmzModel.isModel(dmz))
      assert(dmz.pending.getIsPending())
      const { transmissions } = reduceResolve
      debug(`assignReplayIdentifiers`, transmissions.length)
      return dmzProducer.accumulate(dmz, transmissions)
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
    dmz: ({ initialPending, externalAction, dmz, anvil }) => {
      debug('respondLoopbackRequest')
      assert(pendingModel.isModel(initialPending))
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
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
    const isFromBuffer = dmz.pending.getIsBuffered(anvil)
    const reply = dmz.network.getResponse(anvil)
    // TODO handle transmitting a promise from a buffered loopback request
    const isDone = !!reply && !(isFromBuffer && reply.isPromise())
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
    assignReplayIdentifiers,
    assignResolve,
    reduceCovenant,
    isLoopbackResponseDone,
    respondLoopbackRequest,
    mergeState,
    isAnvilNotLoopback,
  }
}

export { common }
