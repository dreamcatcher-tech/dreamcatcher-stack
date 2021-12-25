import assert from 'assert-fast'
import {
  TxReply,
  RxReply,
  RxRequest,
  Dmz,
  Reduction,
  TxRequest,
} from '../../../w015-models'
import { networkProducer, pendingProducer } from '../../../w016-producers'
import { directMachine } from '../machines'
import { assign } from 'xstate'
import { common } from './common'
import Debug from 'debug'
const debug = Debug('interblock:cfg:direct')

const {
  transmit,
  assignReplayIdentifiers,
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
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxRequest || anvil instanceof RxReply)
        assert(!dmz.pending.getIsPending())
        assert(!dmz.pending.accumulator)
        debug(`assignDirectCovenantAction`, anvil.type)
        return anvil
      },
    }),
    warnReplyRejection: ({ reduceRejection }) => {
      // TODO reject all loopback actions and reject the external action
      debug(`warnReplyRejection`)
      // console.error(reduceRejection)
    },
    raisePending: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxRequest)
        assert(!dmz.pending.getIsPending())
        debug(`raisePending`, anvil.type)
        const pending = pendingProducer.raisePending(dmz.pending, anvil)
        return Dmz.clone({ ...dmz, pending })
      },
    }),
    assignInitialPending: assign({
      initialPending: ({ dmz }) => {
        // TODO this probably breaks other things in weird undiscovered ways
        // as it isn't supposed to change during execution
        // but this handles if a promise raises and lowers in a single interpreter cycle
        assert(dmz instanceof Dmz)
        assert(dmz.pending.getIsPending())
        debug(`assignInitialPending`)
        return dmz.pending
      },
    }),
    promiseOriginRequest: assign({
      dmz: ({ dmz, anvil, covenantAction }) => {
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxRequest)
        assert(!covenantAction || anvil.equals(covenantAction))
        const { identifier } = anvil
        const promise = TxReply.create('@@PROMISE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [promise])
        debug(`promiseOriginRequest`, anvil.type)
        return Dmz.clone({ ...dmz, network })
      },
      isExternalPromise: () => true,
    }),
    shiftBufferedRequest: assign({
      dmz: ({ dmz, covenantAction }) => {
        debug(`shiftBufferedRequest`, covenantAction.type)
        assert(dmz instanceof Dmz)
        assert(covenantAction instanceof RxRequest)
        assert(dmz.pending.getIsBuffered(covenantAction))
        const rxRequest = dmz.pending.rxBufferedRequest()
        assert(rxRequest instanceof RxRequest)
        assert(rxRequest.equals(covenantAction))

        const pending = pendingProducer.shiftRequests(dmz.pending)
        return Dmz.clone({ ...dmz, pending })
      },
    }),
    filterRePromise: assign({
      reduceResolve: ({ reduceResolve, covenantAction }) => {
        assert(reduceResolve instanceof Reduction)
        assert(covenantAction instanceof RxRequest)
        let { transmissions: txs } = reduceResolve
        txs = txs.filter((tx) => {
          const isForCovenant = tx.identifier === covenantAction.identifier
          if (tx instanceof TxReply && isForCovenant) {
            return !tx.getReply().isPromise()
          }
          assert(tx instanceof TxRequest)
          return true
        })
        const isRepromised = txs.length < reduceResolve.transmissions.length
        debug(`filterRePromise remove tx promise:`, isRepromised)
        return Reduction.clone({ ...reduceResolve, transmissions: txs })
      },
    }),
    assignResolve,
    transmit,
    assignReplayIdentifiers,
    mergeState,
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
      assert(reduceResolve instanceof Reduction)
      const { isPending } = reduceResolve
      debug(`isReductionPending`, isPending)
      return isPending
    },
    isReply: ({ anvil }) => {
      const isReply = anvil instanceof RxReply
      if (!isReply) {
        assert(anvil instanceof RxRequest)
      }
      debug(`isReply: %o`, isReply)
      return isReply
    },
    isBufferedRequest: ({ dmz, covenantAction }) => {
      assert(dmz instanceof Dmz)
      assert(covenantAction instanceof RxRequest)
      assert(dmz instanceof Dmz)
      const { pending } = dmz
      const isBufferedRequest = pending.getIsBuffered(covenantAction)
      debug(`isBufferedRequest`, isBufferedRequest)
      return isBufferedRequest
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
  const machine = { ...directMachine, context }
  return { machine, config }
}

export { directConfig }
