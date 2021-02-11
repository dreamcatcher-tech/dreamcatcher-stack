const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter.autoResolves')
const {
  txReplyModel,
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  pendingModel,
} = require('../../../w015-models')
const { networkProducer } = require('../../../w016-producers')
const { definition } = require('../machines/autoResolves')
const { assign } = require('xstate')
const config = {
  actions: {
    settleExternalAction: assign({
      dmz: ({ dmz, externalAction }) => {
        debug('settleExternalAction')
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(externalAction))
        assert(dmz.network.getAlias(externalAction.getAddress()))
        const response = dmz.network.getResponse(externalAction)
        assert(!response, `existing response: ${response && response.type}`)
        const { sequence } = externalAction
        const reply = txReplyModel.create('@@RESOLVE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [reply])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
  },
  guards: {
    isOriginSettled: ({ initialPending, dmz }) => {
      // if rejection, or resolve, return true
      assert(pendingModel.isModel(initialPending))
      assert(dmzModel.isModel(dmz))
      if (!initialPending.getIsPending()) {
        debug(`isOriginSettled !initialPending.getIsPending()`, true)
        return true
      }
      const { pendingRequest } = initialPending
      assert(rxRequestModel.isModel(pendingRequest))
      const reply = dmz.network.getResponse(pendingRequest)
      const isOriginSettled = reply && !reply.isPromise()
      debug(`isOriginSettled`, isOriginSettled)
      return isOriginSettled
    },
    isPendingUnlowered: ({ initialPending, dmz }) => {
      assert(pendingModel.isModel(initialPending))
      assert(dmzModel.isModel(dmz))
      const isPendingLowered =
        initialPending.getIsPending() && !dmz.pending.getIsPending()
      const isPendingUnlowered = !isPendingLowered
      debug(`isPendingUnlowered`, isPendingUnlowered)
      return isPendingUnlowered
    },
    isExternalActionReply: ({ externalAction }) => {
      const isExternalActionReply = rxReplyModel.isModel(externalAction)
      debug(`isExternalActionReply`, isExternalActionReply)
      return isExternalActionReply
    },
    isExternalActionAbsent: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      // loopback would have removed it, or dmz changes might have removed it
      const address = externalAction.getAddress()
      const alias = dmz.network.getAlias(address)
      const isExternalActionAbsent = !alias
      debug(`isExternalActionAbsent: `, isExternalActionAbsent)
      return isExternalActionAbsent
    },
    isExternalActionSettled: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      const reply = dmz.network.getResponse(externalAction)
      const isExternalActionSettled = reply && !reply.isPromise()
      debug(`isExternalActionSettled`, isExternalActionSettled)
      return isExternalActionSettled
    },
    isTxExternalActionPromise: ({ isExternalPromise }) => {
      const isTxExternalActionPromise = !!isExternalPromise
      debug(`isTxExternalActionPromise`, isTxExternalActionPromise)
      return isTxExternalActionPromise
    },
    isExternalActionBuffered: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      const isExternalActionBuffered = dmz.pending.getIsBuffered(externalAction)
      debug(`isExternalActionBuffered`, isExternalActionBuffered)
      return isExternalActionBuffered
    },
  },
}

const autoResolvesConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...definition, context }
  return { machine, config }
}

module.exports = { autoResolvesConfig }
