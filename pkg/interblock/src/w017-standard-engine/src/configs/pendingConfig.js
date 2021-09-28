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
const debug = Debug('interblock:cfg:heart:pending')
const {
  transmit,
  assignResolve,
  respondReply,
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
        const { type } = anvil.getRequest()
        debug(`accumulateReply reply: %o request: %o`, anvil.type, type)
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
    deduplicatePendingReplyTx: assign({
      // TODO warn if during re-execution, new requests are made
      // this could be apparent by not finding requests in channels ?
      reduceResolve: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        let { requests, replies } = reduceResolve
        const isRoot = dmz.network['..'].address.isRoot()
        requests = requests.filter((txRequest) => {
          assert(txRequestModel.isModel(txRequest))
          const to = isRoot ? _dereference(txRequest.to) : txRequest.to
          const channel = dmz.network[to]
          if (!channel) {
            return true
          }
          const request = txRequest.getRequest()
          return !Object.values(channel.requests).some((existing) =>
            request.equals(existing)
          )
        })
        replies = replies.filter((txReply) => {
          assert(txReplyModel.isModel(txReply))
          const address = txReply.getAddress()
          const index = txReply.getIndex()
          const alias = dmz.network.getAlias(address)
          if (!alias) {
            return true
          }
          const existing = dmz.network[alias].replies[index]
          return !txReply.getReply().equals(existing)
        })
        debug(
          `deduplicatePendingReplyTx dedupes: `,
          reduceResolve.requests.length - requests.length
        )
        return reductionModel.clone({ ...reduceResolve, requests, replies })
      },
    }),
    rejectOriginRequest: assign({
      dmz: ({ dmz, anvil, reduceRejection, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel.isModel(anvil))
        assert(rxRequestModel.isModel(covenantAction))
        assert.strictEqual(typeof reduceRejection, 'object')
        debug(`rejectOriginRequest`, anvil.type, reduceRejection)
        const { sequence } = covenantAction
        const reply = txReplyModel.create('@@REJECT', reduceRejection, sequence)
        const network = networkProducer.tx(dmz.network, [], [reply])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    promiseAnvil: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        debug(`promiseanvil`, anvil.type)
        const { sequence } = anvil
        const promise = txReplyModel.create('@@PROMISE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [promise])
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
    respondReply,
    assignResolve,
    transmit,
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
