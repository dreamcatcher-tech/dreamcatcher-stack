const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter')
const {
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
    assignRejection: assign({
      reduceRejection: (context, event) => event.data,
    }),
    assignResolve: assign({
      reduceResolve: ({ anvil }, event) => {
        const { reduceCovenant } = event.data
        assert(reduceCovenant)
        const { reduction, pending, actions } = reduceCovenant
        debug(`reduceResolve pending: %o`, pending)
        return reductionModel.create(reduction, pending, actions, anvil)
      },
    }),
    assignCovenantAction: assign({
      covenantAction: ({ anvil }) => anvil,
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
    accumulate: assign({
      dmz: ({ dmz, anvil }) => {
        // add reply into the accumulator
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel.isModel(anvil))
        debug(`accumulate: `, anvil.type)
        const pending = pendingProducer.pushReply(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    shiftCovenantAction: assign({
      covenantAction: ({ dmz, anvil }) => {
        // get the action that is the first buffered request
        assert(dmzModel.isModel(dmz))
        assert(rxReplyModel(anvil))
        const { network, pending } = dmz
        assert(pending.getIsPending())

        const covenantAction = pending.pendingRequest
        assert(rxRequestModel.isModel(covenantAction))
        debug(`covenantAction: `, covenantAction.type)
        return covenantAction
      },
    }),
    assignOriginalLoopback: assign({
      originalLoopback: ({ dmz }) => dmz.network['.'],
    }),
    mergeSystem: assign({
      dmz: ({ reduceResolve }) => {
        debug('mergeSystem')
        // TODO remove statemodel - replace with reduction ?
        assert(stateModel.isModel(reduceResolve))
        const dmz = dmzModel.clone(reduceResolve.getState())
        const requests = reduceResolve.getRequests()
        const replies = reduceResolve.getReplies()
        const network = networkProducer.tx(dmz.network, requests, replies)
        // TODO check if moving channels around inside dmz can affect tx ?
        return dmzModel.clone({ ...dmz, network })
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
    raisePending: assign({
      dmz: ({ dmz, anvil }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!dmz.pending.getIsPending())
        debug(`raisePending`)
        const pending = pendingProducer.raisePending(dmz.pending, anvil)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    resolveOriginPromise: assign({
      dmz: ({ dmz }) => {
        // if origin promise is still unresponded to, send default reply
        // need to do this before shifting the request buffer
        // might save the originRequest in its entirety, so can
        // withstand structural changes, and still complete its execution paths
      },
    }),
    lowerPending: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        assert(dmz.pending.getIsPending())
        debug(`lowerPending`)
        const pending = pendingProducer.settle(dmz.pending)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    updateState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug(`updateState`)
        // TODO make statemodel have no logic in it
        // macke reductionModel contain the stateModel
        const state = stateModel.create(reduceResolve.reduction)
        return dmzModel.clone({ ...dmz, state })
      },
    }),
    respondReply: assign({
      dmz: ({ dmz, address, originalLoopback }) => {
        assert(dmzModel.isModel(dmz))
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
    respondRejection: assign({
      // one of lifes great challenges
      dmz: ({ dmz, anvil, reduceRejection }) => {
        assert(anvil.type === '@@REJECT')
        assert(dmzModel.isModel(dmz))
        const network = networkProducer.respondRejection(
          dmz.network,
          anvil,
          reduceRejection
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
  },
  guards: {
    isSystem: ({ anvil }) => {
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      // TODO move to statechart conditions
      const isSystem =
        dmzReducer.isSystemReply(anvil) || dmzReducer.isSystemRequest(anvil)
      debug(`isSystem: ${isSystem}`)
      return isSystem
    },
    isSettled: ({ dmz }) => {
      const isSettled = !dmz.pending.getIsPending()
      debug(`isSettled`, isSettled)
      return isSettled
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
    isRequestBuffered: ({ dmz, anvil, reduceResolve }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      const { pending } = dmz
      const isPending = pending.getIsPending()
      const isUnresolved = !reduceResolve // TODO find a stronger way to detect buffer

      // const isRequestBuffered =
    },
    isResponseDone: ({ dmz, anvil, address }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      assert(anvil.getAddress().equals(address))

      const index = anvil.getIndex()
      const isResponseDone = dmz.network.isResponseDone(address, index)
      debug(`isResponseDone: ${!!isResponseDone} anvil: %o`, anvil.type)
      return isResponseDone
    },
    isSelfExhausted: ({ dmz }) => {
      const isSelfExhausted = !dmz.network.rxSelf()
      debug(`isSelfExhausted: ${isSelfExhausted}`)
      return isSelfExhausted
    },
  },
  services: {
    reduceCovenant: async ({ dmz, covenantAction, isolatedTick }) => {
      debug(`reduceCovenant: %o`, covenantAction.type)
      const isReply = rxReplyModel.isModel(covenantAction)
      const isRequest = rxRequestModel.isModel(covenantAction)
      assert(isReply || isRequest)

      const state = dmz.state.getState()
      const accumulator = dmz.pending.getAccumulator()
      const result = await isolatedTick(state, covenantAction, accumulator)
      assert(result, `Covenant returned: ${result}`)
      debug(`result: `, result)
      return { reduceCovenant: result }
      // TODO dedupe all requests that came back during a promise resolve
    },
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
      assert(dmzModel.clone(nextState.getState()), `Uncloneable dmz`)
      return nextState
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
