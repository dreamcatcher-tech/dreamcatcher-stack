const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter')
const {
  txReplyModel,
  txRequestModel,
  rxReplyModel,
  rxRequestModel,
  addressModel,
  dmzModel,
  channelModel,
  reductionModel,
  pendingModel,
} = require('../../../w015-models')
const { networkProducer, pendingProducer } = require('../../../w016-producers')
const dmzReducer = require('../../../w021-dmz-reducer')
const { definition } = require('../machines/interpreter')
const {
  '@@GLOBAL_HOOK_INBAND': globalHookInband,
  resolve,
  reject,
  isReplyFor,
} = require('../../../w002-api')
const { assign } = require('xstate')

const config = {
  actions: {
    assignExternalAction: assign({
      externalAction: (context, event) => {
        const { externalAction } = event.payload
        return externalAction
      },
    }),
    assignDmz: assign({
      dmz: (context, event) => {
        const { dmz, address } = event.payload
        assert(dmzModel.isModel(dmz))
        assert(dmz.network.getAlias(address))
        return dmz
      },
      initialPending: (context, event) => {
        const { dmz } = event.payload
        assert(dmzModel.isModel(dmz))
        return dmz.pending
      },
    }),
    assignAnvil: assign({
      anvil: (context, event) => {
        const { externalAction, address } = event.payload
        const anvil = externalAction
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
        assert(addressModel.isModel(address))
        if (rxRequestModel.isModel(anvil)) {
          assert(anvil.getAddress().equals(address))
        }
        const chainId = address.isInvalid() ? 'INVALID' : address.getChainId()
        debug(`interpreterConfig type: %o chainId: %o`, anvil.type, chainId)
        return anvil
      },
      address: (context, event) => {
        // TODO try replace with something that gets the address dynamically
        const { address } = event.payload
        assert(addressModel.isModel(address))
        const isInvalid = address.isInvalid()
        assert(address.isResolved() || address.isLoopback() || isInvalid)
        return address
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
        assert(selfAddress.isLoopback())
        debug(`loadSelfAnvil selfAddress: %o`, selfAddress.getChainId())
        return selfAddress
      },
    }),
    assignResolve: assign({
      reduceResolve: ({ dmz, anvil }, event) => {
        assert(dmzModel.isModel(dmz))
        const { reduceResolve } = event.data
        assert(reduceResolve)
        const { reduction, isPending, requests, replies } = reduceResolve
        debug(`assignResolve pending: %o`, isPending)
        return reductionModel.create(reduceResolve, anvil, dmz)
      },
    }),
    assignRejection: assign({
      reduceRejection: ({ anvil }, event) => {
        if (rxReplyModel.isModel(anvil)) {
          // TODO do something with replies that cause rejections
          // console.error(anvil)
          // console.error(event.data)
        }
        return event.data
      },
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
        const { pending } = dmz
        assert(pending.getIsPending())

        const covenantAction = pending.pendingRequest
        assert(rxRequestModel.isModel(covenantAction))
        debug(`shiftCovenantAction: `, covenantAction.type)
        return covenantAction
      },
    }),
    mergeSystemState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug('mergeSystemState')
        return dmzModel.clone(reduceResolve.reduction)
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
    transmit: assign({
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
      isExternalPromise: ({
        isExternalPromise,
        externalAction,
        reduceResolve,
      }) => {
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
        const { sequence } = pendingRequest
        const reply = txReplyModel.create('@@RESOLVE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [reply])
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
    warnReplyRejection: ({ reduceRejection }) => {
      // TODO reject all loopback actions and reject the external action
      debug(`warnReplyRejection`)
      console.warn(`Warning: rejection occured during reply`)
      console.warn(reduceRejection)
    },
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
    assignInitialPending: assign({
      initialPending: ({ dmz }) => {
        // TODO this probably breaks other things in weird undiscovered ways
        // as it isn't supposed to change during execution
        // but this handles if a promise raises and lowers in a single interpreter cycle
        assert(dmzModel.isModel(dmz))
        assert(dmz.pending.getIsPending())
        debug(`assignInitialPending`)
        return dmz.pending
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
    promiseOriginRequest: assign({
      dmz: ({ dmz, anvil, covenantAction }) => {
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(!covenantAction || anvil.equals(covenantAction))
        const { sequence } = anvil
        const promise = txReplyModel.create('@@PROMISE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [promise])
        debug(`promiseOriginRequest`, anvil.type)
        return dmzModel.clone({ ...dmz, network })
      },
      isExternalPromise: () => true,
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
        return dmzModel.clone({ ...dmz, state: reduceResolve.reduction })
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
    respondRequest: assign({
      dmz: ({ externalAction, dmz, address, anvil }) => {
        debug('respondRequest')
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(anvil.getAddress().equals(address))
        assert(!anvil.equals(externalAction))
        const network = networkProducer.respondRequest(dmz.network, anvil)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    shiftBufferedRequests: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        debug(`shiftBufferedRequests`)
        const pending = pendingProducer.shiftRequests(dmz.pending, dmz.network)
        return dmzModel.clone({ ...dmz, pending })
      },
    }),
    defaultResolve: assign({
      dmz: ({ dmz, externalAction }) => {
        debug('defaultResolve')
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(externalAction))
        assert(dmz.network.getAlias(externalAction.getAddress()))
        const { sequence } = externalAction
        const reply = txReplyModel.create('@@RESOLVE', {}, sequence)
        const network = networkProducer.tx(dmz.network, [], [reply])
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    openPaths: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        debug(`openPaths`)
        const network = dmzReducer.openPaths(dmz.network)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    invalidateLocalPaths: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        debug('invalidateLocalPaths')
        const network = networkProducer.invalidateLocal(dmz.network)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    removeEmptyInvalidChannels: assign({
      dmz: ({ dmz }) => {
        assert(dmzModel.isModel(dmz))
        const network = networkProducer.reaper(dmz.network)
        const startCount = Object.keys(dmz.network).length
        const endCount = Object.keys(network).length
        debug(`removeEmptyInvalidChannels removed: ${startCount - endCount}`)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
    assertLoopbackEmpty: ({ dmz }) => {
      // TODO move to being a test, not a live assertion
      debug(`assertLoopbackEmpty`)
      const loopback = dmz.network['.']
      assert(!loopback.rxRequest())
      assert(!loopback.rxReply())
    },
  },
  guards: {
    isSelfExhausted: ({ dmz }) => {
      const isSelfExhausted = !dmz.network.rxSelf()
      debug(`isSelfExhausted: ${isSelfExhausted}`)
      return isSelfExhausted
    },
    isSystem: ({ anvil }) => {
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      const isSystem =
        dmzReducer.isSystemReply(anvil) || dmzReducer.isSystemRequest(anvil)
      debug(`isSystem: ${isSystem}`)
      return isSystem
    },
    isExternalAction: ({ externalAction, anvil, address }) => {
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      assert(addressModel.isModel(address))
      const isExternalAction = !address.isLoopback()
      assert(!isExternalAction || externalAction.equals(anvil))
      debug(`isExternalAction`, isExternalAction)
      return isExternalAction
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
    isAnvilPromised: ({ dmz, anvil }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      const response = dmz.network.getResponse(anvil)
      const isAnvilPromised = response && response.isPromise()
      debug(`isAnvilPromised`, isAnvilPromised)
      return isAnvilPromised
    },
    isUnbuffered: ({ dmz, covenantAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(covenantAction))
      const { pending } = dmz
      const isUnbuffered = !pending.getIsBuffered(covenantAction)
      debug(`isUnbuffered`, isUnbuffered)
      return isUnbuffered
    },
    isLoopbackResponseDone: ({ dmz, anvil, address }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      assert(anvil.getAddress().equals(address))
      assert(address.isLoopback())

      const isDone = !!dmz.network.getResponse(anvil)
      debug(`isLoopbackResponseDone: %o anvil: %o`, isDone, anvil.type)
      return isDone
    },
    isOriginSettled: ({ initialPending, dmz }) => {
      // if rejection, or resolve, return true
      assert(pendingModel.isModel(initialPending))
      assert(dmzModel.isModel(dmz))
      if (!initialPending.getIsPending()) {
        debug(`isOriginSettled`, true)
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
    isTxOriginPromise: ({ isOriginPromise }) => {
      debug(`isTxOriginPromise`, isOriginPromise)
      return isOriginPromise
    },
    isExternalActionReply: ({ externalAction }) => {
      const isExternalActionReply = rxReplyModel.isModel(externalAction)
      debug(`isExternalActionReply`, isExternalActionReply)
      return isExternalActionReply
    },
    isExternalActionPresent: ({ dmz, externalAction }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(externalAction))
      // loopback would have removed it, or dmz changes might have removed it
      const address = externalAction.getAddress()
      const index = externalAction.getIndex()
      const alias = dmz.network.getAlias(address)
      const channel = dmz.network[alias]
      const isPresent = channel && channel.requests[index]
      debug(`isExternalActionPresent: `, !!isPresent)
      return isPresent
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
  },
  services: {
    reduceSystem: async ({ dmz, anvil }) => {
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      debug(`reduceSystem anvil: %o`, anvil.type)
      // TODO move to be same code as isolateFactory
      const tick = () => dmzReducer.reducer(dmz, anvil)
      const accumulator = []
      const salt = `TODO` // TODO make salt depend on something else, like the io channel index
      const reduceResolve = await globalHookInband(tick, accumulator, salt)

      debug(`result isPending: `, reduceResolve.isPending)
      assert(reduceResolve, `System returned: ${reduceResolve}`)
      assert(!reduceResolve.isPending, `System can never raise pending`)
      return { reduceResolve }
    },
    reduceCovenant: async ({ dmz, covenantAction, isolatedTick }) => {
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
    },
  },
}

const _dereference = (path) => {
  if (path.startsWith('/')) {
    assert.notStrictEqual(path, '/')
    return path.substring(1)
  }
  return path
}

const interpreterConfig = (isolatedTick) => {
  assert.strictEqual(typeof isolatedTick, 'function')
  // TODO multiplex the function with a code, so can use the same machine repeatedly
  const machine = { ...definition, context: { isolatedTick } }
  return { machine, config }
}

module.exports = { interpreterConfig }
