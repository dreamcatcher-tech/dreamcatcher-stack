import assert from 'assert-fast'
import {
  RxReply,
  RxRequest,
  Dmz,
  reductionModel,
  Pending,
} from '../../../w015-models'
import { networkProducer, dmzProducer } from '../../../w016-producers'
import { assign } from 'xstate'
const common = (debug) => {
  const reduceCovenant = async ({ dmz, covenantAction, isolatedTick }) => {
    // TODO test the actions are allowed actions using the ACL
    assert(dmz instanceof Dmz)
    const replyKey = covenantAction.getReplyKey()
    debug(`reduceCovenant: %o`, covenantAction.type, replyKey)
    const isReply = covenantAction instanceof RxReply
    const isRequest = covenantAction instanceof RxRequest
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
      assert(dmz instanceof Dmz)
      const { reduceResolve } = event.data
      assert(reduceResolve)
      debug(`assignResolve pending: %o`, reduceResolve.isPending)
      return reductionModel.create(reduceResolve, anvil, dmz)
    },
  })
  const assignRejection = assign({
    reduceRejection: ({ anvil }, event) => {
      if (anvil instanceof RxReply) {
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
      assert(dmz instanceof Dmz)
      const network = networkProducer.respondRejection(
        dmz.network,
        anvil,
        reduceRejection
      )
      return Dmz.clone({ ...dmz, network })
    },
  })
  const transmit = assign({
    dmz: ({ dmz, reduceResolve }) => {
      assert(dmz instanceof Dmz)
      assert(reductionModel.isModel(reduceResolve))
      const { transmissions } = reduceResolve
      debug('transmit transmissions.length: %o', transmissions.length)
      // TODO check if moving channels around inside dmz can affect tx ?
      const network = networkProducer.tx(dmz.network, transmissions)
      return Dmz.clone({ ...dmz, network })
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
      if (externalAction instanceof RxReply) {
        debug(`transmit isExternalPromise`, false)
        return false
      }
      assert(externalAction instanceof RxRequest)
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
      assert(initialPending instanceof Pending)
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
      assert(dmz instanceof Dmz)
      assert(dmz.pending.getIsPending())
      const { transmissions } = reduceResolve
      debug(`assignReplayIdentifiers`, transmissions.length)
      return dmzProducer.accumulate(dmz, transmissions)
    },
  })
  const isReply = ({ anvil }) => {
    const isReply = anvil instanceof RxReply
    if (!isReply) {
      assert(anvil instanceof RxRequest)
    }
    debug(`isReply: %o`, isReply)
    return isReply
  }
  const respondLoopbackRequest = assign({
    dmz: ({ initialPending, externalAction, dmz, anvil }) => {
      debug('respondLoopbackRequest')
      assert(initialPending instanceof Pending)
      assert(dmz instanceof Dmz)
      assert(anvil instanceof RxRequest)
      const isFromBuffer = initialPending.getIsBuffered(anvil)
      const msg = `externalAction can only be responded to by auto resolvers`
      assert(!anvil.equals(externalAction) || isFromBuffer, msg)
      const network = networkProducer.respondRequest(dmz.network, anvil)
      return Dmz.clone({ ...dmz, network })
    },
  })
  const isLoopbackResponseDone = ({ dmz, anvil }) => {
    assert(dmz instanceof Dmz)
    assert(anvil instanceof RxRequest)
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
      assert(dmz instanceof Dmz)
      assert(reductionModel.isModel(reduceResolve))
      debug(`mergeState`)
      return Dmz.clone({ ...dmz, state: reduceResolve.reduction })
    },
  })
  const isAnvilNotLoopback = ({ anvil }) => {
    // non loopback anvil is the external action, and will be autoResolve'd
    assert(anvil instanceof RxRequest)
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
