import assert from 'assert-fast'
import {
  txReplyModel,
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  reductionModel,
  txRequestModel,
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
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        debug(`bufferRequest: `, anvil.type)
        const pending = pendingProducer.bufferRequest(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    accumulateReply: assign({
      dmz: ({ dmz, anvil }) => {
        // add reply into the accumulator
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel.isModel(anvil))
        debug(`accumulateReply replyKey: %o`, anvil.getReplyKey())
        const pending = pendingProducer.pushReply(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    shiftCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel.isModel(anvil))
        const { pending } = dmz
        assert(pending.getIsPending())

        const originRequest = pending.pendingRequest
        assert(rxRequestModel.isModel(originRequest))
        debug(`shiftCovenantAction: %o`, originRequest.type)
        return originRequest
      },
    }),
    assignPendingResolve: assign({
      reduceResolve: ({ dmz, covenantAction }, event) => {
        assert(dmzModel.isModel(dmz))
        const { reduceResolve } = event.data
        assert(reduceResolve)
        debug(`assignResolve pending: %o`, reduceResolve.isPending)
        return reductionModel.create(reduceResolve, covenantAction, dmz)
      },
    }),
    rejectOriginRequest: assign({
      dmz: ({ dmz, anvil, reduceRejection, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel.isModel(anvil))
        assert(rxRequestModel.isModel(covenantAction))
        assert.strictEqual(typeof reduceRejection, 'object')
        debug(`rejectOriginRequest`, anvil.type, reduceRejection)
        const { identifier: id } = covenantAction
        const reply = txReplyModel.create('@@REJECT', reduceRejection, id)
        const network = networkProducer.tx(dmz.network, [reply])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    promiseAnvil: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        debug(`promiseanvil`, anvil.type)
        const { identifier } = anvil
        const promise = txReplyModel.create('@@PROMISE', {}, identifier)
        const network = networkProducer.tx(dmz.network, [promise])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    settlePending: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        assert(dmz.pending.getIsPending())
        debug(`settlePending`)
        const pending = pendingProducer.settle(dmz.pending)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    mergeState,
    transmit,
    assignReplayIdentifiers,
    assignRejection,
  },
  guards: {
    isReply: ({ anvil }) => {
      const isReply = rxReplyModel.isModel(anvil)
      if (!isReply) {
        assert(rxRequestModel.isModel(anvil))
      }
      debug(`isReply: %o`, isReply)
      return isReply
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
