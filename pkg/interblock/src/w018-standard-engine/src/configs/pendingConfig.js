import assert from 'assert-fast'
import {
  TxReply,
  RxReply,
  RxRequest,
  Dmz,
  reductionModel,
  TxRequest,
} from '../../../w015-models'
import { networkProducer, pendingProducer } from '../../../w016-producers'
import { pendingMachine } from '../machines'
import { assign } from 'xstate'
import { common } from './common'
import Debug from 'debug'
const debug = Debug('interblock:cfg:pending')
const {
  transmit,
  assignReplayIdentifiers,
  reduceCovenant,
  assignRejection,
  mergeState,
} = common(debug)
const config = {
  actions: {
    bufferRequest: assign({
      dmz: ({ dmz, anvil }) => {
        // if a request came in and we are pending, put it on buffer
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxRequest)
        debug(`bufferRequest: `, anvil.type)
        const pending = pendingProducer.bufferRequest(dmz.pending, anvil)
        return Dmz.clone({ ...dmz, pending })
      },
    }),
    accumulateReply: assign({
      dmz: ({ dmz, anvil }) => {
        // add reply into the accumulator
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxReply)
        debug(`accumulateReply replyKey: %o`, anvil.getReplyKey())
        const pending = pendingProducer.pushReply(dmz.pending, anvil)
        return Dmz.clone({ ...dmz, pending })
      },
    }),
    shiftCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxReply)
        const { pending } = dmz
        assert(pending.getIsPending())

        const originRequest = pending.pendingRequest
        assert(originRequest instanceof RxRequest)
        debug(`shiftCovenantAction: %o`, originRequest.type)
        return originRequest
      },
    }),
    assignPendingResolve: assign({
      reduceResolve: ({ dmz, covenantAction }, event) => {
        assert(dmz instanceof Dmz)
        const { reduceResolve } = event.data
        assert(reduceResolve)
        debug(`assignResolve pending: %o`, reduceResolve.isPending)
        return reductionModel.create(reduceResolve, covenantAction, dmz)
      },
    }),
    rejectOriginRequest: assign({
      dmz: ({ dmz, anvil, reduceRejection, covenantAction }) => {
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxReply)
        assert(covenantAction instanceof RxRequest)
        assert.strictEqual(typeof reduceRejection, 'object')
        debug(`rejectOriginRequest`, anvil.type, reduceRejection)
        const { identifier: id } = covenantAction
        const reply = TxReply.create('@@REJECT', reduceRejection, id)
        const network = networkProducer.tx(dmz.network, [reply])
        return Dmz.clone({ ...dmz, network })
      },
    }),
    promiseAnvil: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmz instanceof Dmz)
        assert(anvil instanceof RxRequest)
        debug(`promiseanvil`, anvil.type)
        const { identifier } = anvil
        const promise = TxReply.create('@@PROMISE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [promise])
        return Dmz.clone({ ...dmz, network })
      },
    }),
    settlePending: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        assert(dmz.pending.getIsPending())
        debug(`settlePending`)
        const pending = pendingProducer.settle(dmz.pending)
        return Dmz.clone({ ...dmz, pending })
      },
    }),
    mergeState,
    transmit,
    assignReplayIdentifiers,
    assignRejection,
  },
  guards: {
    isReply: ({ anvil }) => {
      const isReply = anvil instanceof RxReply
      if (!isReply) {
        assert(anvil instanceof RxRequest)
      }
      debug(`isReply: %o`, isReply)
      return isReply
    },
    isAwaiting: ({ dmz }) => {
      assert(dmz instanceof Dmz)
      const { pending } = dmz
      let isAwaiting = false
      for (const accumulation of pending.accumulator) {
        const { to, reply } = accumulation
        if (to && !to === '.' && !reply) {
          // do not skip if self, due to self stalling possibility
          isAwaiting = true
          break
        }
      }
      debug(`isAwaiting:`, isAwaiting)
      return isAwaiting
    },
    isReductionPending: ({ reduceResolve }) => {
      assert(reductionModel.isModel(reduceResolve))
      const isReductionPending = reduceResolve.getIsPending()
      debug(`isReductionPending`, isReductionPending)
      return isReductionPending
    },
  },
  services: {
    reduceCovenant,
  },
}
const _dereference = (path) => {
  if (path.startsWith('/')) {
    assert(path !== '/')
    return path.substring(1)
  }
  return path
}

const pendingConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...pendingMachine, context }
  return { machine, config }
}

export { pendingConfig }
