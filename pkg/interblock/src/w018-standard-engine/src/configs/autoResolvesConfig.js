import assert from 'assert-fast'
import { TxReply, RxReply, RxRequest, Dmz, Pending } from '../../../w015-models'
import { networkProducer } from '../../../w016-producers'
import { autoResolvesMachine } from '../machines'
import { assign } from 'xstate'
import Debug from 'debug'
const debug = Debug('interblock:cfg:autoResolves')

const config = {
  actions: {
    resolveExternalAction: assign({
      dmz: ({ dmz, externalAction }) => {
        const replyKey = externalAction.getReplyKey()
        debug('resolveExternalAction', externalAction.type, replyKey)
        assert(dmz instanceof Dmz)
        assert(externalAction instanceof RxRequest)
        assert(dmz.network.getAlias(externalAction.getAddress()))
        const response = dmz.network.getResponse(externalAction)
        if (response && response.type !== '@@PROMISE') {
          assert(!response, `existing response: ${response && response.type}`)
        }
        const { identifier } = externalAction
        const reply = TxReply.create('@@RESOLVE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [reply])
        return Dmz.clone({ ...dmz, network })
      },
    }),
    settleOrigin: assign({
      dmz: ({ initialPending, dmz }) => {
        assert(initialPending instanceof Pending)
        assert(initialPending.getIsPending())
        assert(dmz instanceof Dmz)
        assert(!dmz.pending.getIsPending())
        const { pendingRequest } = initialPending
        assert(pendingRequest instanceof RxRequest)
        assert(dmz.network.getAlias(pendingRequest.getAddress()))
        debug(`settleOrigin`, pendingRequest)
        const { identifier } = pendingRequest
        const reply = TxReply.create('@@RESOLVE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [reply])
        return dmz.update({ network })
      },
    }),
  },
  guards: {
    isNotPending: ({ initialPending }) => {
      assert(initialPending instanceof Pending)
      const isNotPending = !initialPending.getIsPending()
      debug(`isNotPending`, isNotPending)
      return isNotPending
    },
    isOriginSettled: ({ initialPending, dmz }) => {
      // if rejection, or resolve, return true
      assert(initialPending instanceof Pending)
      assert(dmz instanceof Dmz)
      const { pendingRequest } = initialPending
      assert(pendingRequest instanceof RxRequest)
      const reply = dmz.network.getResponse(pendingRequest)
      const isOriginSettled = reply && !reply.isPromise()
      debug(`isOriginSettled`, isOriginSettled)
      return isOriginSettled
    },
    isStillPending: ({ initialPending, dmz }) => {
      assert(initialPending instanceof Pending)
      assert(dmz instanceof Dmz)
      const isStillPending =
        initialPending.getIsPending() && dmz.pending.getIsPending()
      debug(`isStillPending`, isStillPending)
      return isStillPending
    },
    isExternalActionReply: ({ externalAction }) => {
      const isExternalActionReply = externalAction instanceof RxReply
      debug(`isExternalActionReply`, isExternalActionReply)
      return isExternalActionReply
    },
    isChannelRemoved: ({ dmz, externalAction }) => {
      assert(dmz instanceof Dmz)
      assert(externalAction instanceof RxRequest)
      const address = externalAction.getAddress()
      const isChannelRemoved = !dmz.network.getByAddress(address)
      debug(`isChannelRemoved`, isChannelRemoved)
      return isChannelRemoved
    },
    isExternalRequestSettled: ({ dmz, externalAction }) => {
      assert(dmz instanceof Dmz)
      assert(externalAction instanceof RxRequest)
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
    isExternalRequestFromBuffer: ({ initialDmz, externalAction }) => {
      assert(initialDmz instanceof Dmz)
      assert(externalAction instanceof RxRequest)
      const isExternalRequestFromBuffer =
        initialDmz.pending.getIsBuffered(externalAction)
      debug(`isExternalRequestFromBuffer`, isExternalRequestFromBuffer)
      return isExternalRequestFromBuffer
    },
    isExternalRequestBuffered: ({ dmz, externalAction }) => {
      assert(dmz instanceof Dmz)
      assert(externalAction instanceof RxRequest)
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
