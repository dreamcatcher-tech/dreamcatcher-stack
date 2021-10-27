import assert from 'assert-fast'
import {
  txReplyModel,
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  pendingModel,
} from '../../../w015-models'
import { networkProducer } from '../../../w016-producers'
import { autoResolvesMachine } from '../machines'
import { assign } from 'xstate'
import Debug from 'debug'
const debug = Debug('interblock:cfg:autoResolves')

const config = {
  actions: {
    resolveExternalAction: assign({
      dmz: ({ dmz, externalAction }) => {
        debug('resolveExternalAction')
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(externalAction))
        assert(dmz.network.getAlias(externalAction.getAddress()))
        const response = dmz.network.getResponse(externalAction)
        assert(!response, `existing response: ${response && response.type}`)
        const { identifier } = externalAction
        const reply = txReplyModel.create('@@RESOLVE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [], [reply])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    settleOrigin: assign({
      dmz: ({ initialPending, dmz }) => {
        assert(pendingModel.isModel(initialPending))
        assert(initialPending.getIsPending())
        assert(dmzModel.isModel(dmz))
        assert(!dmz.pending.getIsPending())
        const { pendingRequest } = initialPending
        assert(rxRequestModel.isModel(pendingRequest))
        assert(dmz.network.getAlias(pendingRequest.getAddress()))
        debug(`settleOrigin`, pendingRequest)
        const { identifier } = pendingRequest
        const reply = txReplyModel.create('@@RESOLVE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [], [reply])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
  },
  guards: {
    isNotPending: ({ initialPending }) => {
      assert(pendingModel.isModel(initialPending))
      const isNotPending = !initialPending.getIsPending()
      debug(`isNotPending`, isNotPending)
      return isNotPending
    },
    isOriginSettled: ({ initialPending, dmz }) => {
      // if rejection, or resolve, return true
      assert(pendingModel.isModel(initialPending))
      assert(dmzModel.isModel(dmz))
      const { pendingRequest } = initialPending
      assert(rxRequestModel.isModel(pendingRequest))
      const reply = dmz.network.getResponse(pendingRequest)
      const isOriginSettled = reply && !reply.isPromise()
      debug(`isOriginSettled`, isOriginSettled)
      return isOriginSettled
    },
    isStillPending: ({ initialPending, dmz }) => {
      assert(pendingModel.isModel(initialPending))
      assert(dmzModel.isModel(dmz))
      const isStillPending =
        initialPending.getIsPending() && dmz.pending.getIsPending()
      debug(`isStillPending`, isStillPending)
      return isStillPending
    },
    isExternalActionReply: ({ externalAction }) => {
      const isExternalActionReply = rxReplyModel.isModel(externalAction)
      debug(`isExternalActionReply`, isExternalActionReply)
      return isExternalActionReply
    },
    isChannelRemoved: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      const address = externalAction.getAddress()
      const isChannelRemoved = !dmz.network.getAlias(address)
      debug(`isChannelRemoved`, isChannelRemoved)
      return isChannelRemoved
    },
    isExternalRequestSettled: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      const reply = dmz.network.getResponse(externalAction)
      const isExternalRequestSettled = reply && !reply.isPromise()
      const { type } = externalAction
      debug(`isExternalRequestSettled`, isExternalRequestSettled, type)
      return isExternalRequestSettled
    },
    isTxExternalActionPromise: ({ isExternalPromise }) => {
      // TODO try replace by removing the pending promise each run
      const isTxExternalActionPromise = !!isExternalPromise
      debug(`isTxExternalActionPromise`, isTxExternalActionPromise)
      return isTxExternalActionPromise
    },
    isExternalRequestBuffered: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      const isExternalRequestBuffered =
        dmz.pending.getIsBuffered(externalAction)
      debug(`isExternalRequestBuffered`, isExternalRequestBuffered)
      return isExternalRequestBuffered
    },
  },
  services: {},
}

const autoResolvesConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...autoResolvesMachine, context }
  return { machine, config }
}

export { autoResolvesConfig }
