const assert = require('assert')
const debug = require('debug')('interblock:config:common')
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
    debug('respondReply')
    const network = networkProducer.respondReply(
      dmz.network,
      address,
      originalLoopback
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
  isExternalPromise: ({ isExternalPromise, externalAction, reduceResolve }) => {
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

module.exports = { transmit, respondReply, assignResolve, reduceCovenant }
