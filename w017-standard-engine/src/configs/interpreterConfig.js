const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter')
const {
  txReplyModel,
  rxReplyModel,
  rxRequestModel,
  addressModel,
  stateModel,
  dmzModel,
  channelModel,
  reductionModel,
} = require('../../../w015-models')
const { networkProducer, pendingProducer } = require('../../../w016-producers')
const dmzReducer = require('../../../w021-dmz-reducer')
const { machine } = require('../machines/interpreter')
const { assign } = require('xstate')

const interpreterMachine = machine.withConfig({
  actions: {
    loadSelfAnvil: assign({
      anvil: ({ dmz }) => {
        const anvil = dmz.network.rxSelf()
        debug(`loadSelfAnvil anvil: %o`, anvil.type)
        return anvil
      },
      address: ({ dmz }) => {
        const selfAddress = dmz.network['.'].address
        assert(selfAddress, `Self not found`)
        debug(`loadSelfAnvil selfAddress: %o`, selfAddress.getChainId())
        return selfAddress
      },
    }),
    assignResolve: assign({
      reduceResolve: ({ anvil }, event) => {
        const { reduceCovenant } = event.data
        assert(reduceCovenant)
        const { reduction, pending, actions } = reduceCovenant
        debug(`assignResolve pending: %o`, pending)
        return reductionModel.create(reduction, pending, actions, anvil)
      },
    }),
    assignRejection: assign({
      reduceRejection: (context, event) => event.data,
    }),
    respondRejection: assign({
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
    }),
    assignDirectCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        assert(!dmz.pending.getAccumulator().length)
        return anvil
      },
    }),
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
        debug(`accumulateReply: `, anvil.type)
        const pending = pendingProducer.pushReply(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    shiftCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        // get the action that is the first buffered request
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel.isModel(anvil))
        const { network, pending } = dmz
        assert(pending.getIsPending())

        const covenantAction = pending.pendingRequest
        assert(rxRequestModel.isModel(covenantAction))
        debug(`shiftCovenantAction: `, covenantAction.type)
        return covenantAction
      },
    }),
    transmitSystem: assign({
      dmz: ({ reduceResolve }) => {
        debug('transmitSystem')
        const requests = reduceResolve.getRequests()
        const replies = reduceResolve.getReplies()
        const network = networkProducer.tx(dmz.network, requests, replies)
        // TODO check if moving channels around inside dmz can affect tx ?
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    mergeSystemState: assign({
      dmz: ({ reduceResolve }) => {
        debug('mergeSystemState')
        // TODO remove statemodel - replace with reduction ?
        assert(stateModel.isModel(reduceResolve))
        return dmzModel.clone(reduceResolve.getState())
      },
    }),
    // TODO both merges do a network tx, then different merges to dmz - unify these
    transmit: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        const { requests, replies } = reduceResolve
        debug('transmit req: %o rep %o', requests.length, replies.length)
        const network = networkProducer.tx(dmz.network, requests, replies)
        return dmzModel.clone({ ...dmz, network })
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
    raisePending: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        debug(`raisePending`, anvil.type)
        const pending = pendingProducer.raisePending(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    promiseOriginRequest: assign({
      dmz: ({ dmz, anvil, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(anvil.equals(covenantAction))
        const { sequence } = anvil
        const promise = txReplyModel.create('@@PROMISE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [promise])
        debug(`promiseOriginRequest`, anvil.type)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    resolveOriginRequest: assign({
      dmz: ({ dmz, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(covenantAction))
        debug(`resolveOriginRequest`)
        const { sequence } = covenantAction
        const reply = txReplyModel.create('@@RESOLVE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [reply])
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
    mergeState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug(`mergeState`)
        // TODO make statemodel have no logic in it
        const state = stateModel.create(reduceResolve.reduction)
        return dmzModel.clone({ ...dmz, state })
      },
    }),
    respondReply: assign({
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
    }),

    respondPromise: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        // assert no prior promise or resolution to the request
        // do not overwrite an existing reply to the triggering action

        return dmz
      },
    }),
    respondRequest: assign({
      dmz: ({ dmz, address, anvil }) => {
        debug('respondRequest')
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(anvil.getAddress().equals(address))
        const network = networkProducer.respondRequest(dmz.network, anvil)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
  },
  guards: {
    isSelfExhausted: ({ dmz }) => {
      const isSelfExhausted = !dmz.network.rxSelf()
      debug(`isSelfExhausted: ${isSelfExhausted}`)
      return isSelfExhausted
    },
    isSystem: ({ anvil }) => {
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      // TODO move to statechart conditions
      const isSystem =
        dmzReducer.isSystemReply(anvil) || dmzReducer.isSystemRequest(anvil)
      debug(`isSystem: ${isSystem}`)
      return isSystem
    },
    isPending: ({ dmz }) => {
      const isPending = dmz.pending.getIsPending()
      debug(`isPending`, isPending)
      return isPending
    },
    isReductionPending: ({ reduceResolve }) => {
      assert(reductionModel.isModel(reduceResolve))
      const isReductionPending = reduceResolve.getIsPending()
      debug(`isReductionPending`, isReductionPending)
      return isReductionPending
    },
    isRequest: ({ anvil }) => {
      const isRequest = rxRequestModel.isModel(anvil)
      debug(`isRequest`, isRequest)
      return isRequest
    },
    isPendingRaised: ({ dmz, reduceResolve }) => {
      assert(dmzModel.isModel(dmz))
      assert(reductionModel.isModel(reduceResolve))
      const isPendingRaised =
        reduceResolve.getIsPending() && !dmz.pending.getIsPending()
      debug(`isPendingRaised: `, isPendingRaised)
      return isPendingRaised
    },
    isPendingLowered: ({ dmz, reduceResolve }) => {
      assert(dmzModel.isModel(dmz))
      assert(reductionModel.isModel(reduceResolve))
      const isPendingLowered =
        !reduceResolve.getIsPending() && dmz.pending.getIsPending()
      debug(`isPendingLowered: `, isPendingLowered)
      return isPendingLowered
    },
    isChannelUnavailable: ({ dmz, address }) => {
      assert(addressModel.isModel(address), `If Anvil, then address required`)
      assert(!address.isUnknown(), `Address unknown`)
      const alias = dmz.network.getAlias(address)
      debug(`isChannelUnavailable: `, !alias)
      return !alias
    },
    isReply: ({ anvil }) => {
      const isReply = rxReplyModel.isModel(anvil)
      if (!isReply) {
        assert(rxRequestModel.isModel(anvil))
      }
      debug(`isReply: %o`, isReply)
      return isReply
    },
    isRejection: ({ reduceRejection }) => {
      debug(`isRejection ${!!reduceRejection}`)
      if (reduceRejection) {
        debug(reduceRejection.message)
      }
      return reduceRejection
    },
    isUnbuffered: ({ dmz, covenantAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(covenantAction))
      const { pending } = dmz
      const isUnbuffered = !pending.getIsBuffered(covenantAction)
      debug(`isUnbuffered`, isUnbuffered)
      return isUnbuffered
    },
    isSystemResponseFromActions: ({ dmz, anvil, address }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      assert(anvil.getAddress().equals(address))

      const index = anvil.getIndex()
      const isResponseDone = dmz.network.isResponseDone(address, index)
      debug(`isResponseDone: ${!!isResponseDone} anvil: %o`, anvil.type)
      return isResponseDone
    },
    isResponseFromActions: ({ covenantAction, reduceResolve }) => {
      assert(rxRequestModel.isModel(covenantAction))
      assert(reductionModel.isModel(reduceResolve))
      // TODO handle promise being returned part way thru pending
      const { replies } = reduceResolve
      const isResponseFromActions = replies.some((reply) =>
        isReplyFor(reply, covenantAction)
      )
      debug(`isResponseFromActions: `, isResponseFromActions)
      return isResponseFromActions
    },
  },
  services: {
    reduceSystem: async ({ dmz, anvil }) => {
      debug(`reduceSystem anvil: %o`, anvil.type)
      assert(anvil)
      // TODO use hook() function
      const result = await dmzReducer.reducer(dmz, anvil)
      assert(result, `System returned: ${result}`)
      const nextState = stateModel.create(result, anvil)
      // TODO move dmz to not use actions, but use hooks instead
      // then delete the stateModel logic
      // TODO move to reduction model ?
      // assert system can never raise pending
      assert(dmzModel.clone(nextState.getState()), `Uncloneable dmz`)
      return nextState
    },
    reduceCovenant: async ({ dmz, covenantAction, isolatedTick }) => {
      // TODO test the actions are allowed actions using the ACL
      debug(`reduceCovenant: %o`, covenantAction.type)
      const isReply = rxReplyModel.isModel(covenantAction)
      const isRequest = rxRequestModel.isModel(covenantAction)
      assert(isReply || isRequest)

      const state = dmz.state.getState()
      const accumulator = dmz.pending.getAccumulator()
      const result = await isolatedTick(state, covenantAction, accumulator)
      assert(result, `Covenant returned: ${result}`)
      debug(`reduceCovenant result pending: `, result.pending)
      return { reduceCovenant: result }
      // TODO dedupe all requests that came back during a promise resolve
    },
  },
})

const interpreterConfig = (isolatedTick, dmz, anvil, address) => {
  assert(typeof isolatedTick === 'function')
  assert(dmzModel.isModel(dmz))
  assert(addressModel.isModel(address))
  assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
  if (rxRequestModel.isModel(anvil)) {
    assert(anvil.getAddress().equals(address))
  }
  debug(
    `interpreterConfig: %o from chainId: %o`,
    anvil.type,
    address.getChainId()
  )
  return interpreterMachine.withContext({ dmz, anvil, address, isolatedTick })
}

module.exports = { interpreterConfig }
