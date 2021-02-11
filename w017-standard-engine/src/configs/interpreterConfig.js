const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter')
const detailedDiff = require('deep-object-diff').detailedDiff
const { pure } = require('../../../w001-xstate-direct')
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
const { directConfig } = require('./directConfig')
const { pendingConfig } = require('./pendingConfig')
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

    mergeSystemState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug('mergeSystemState')
        return dmzModel.clone(reduceResolve.reduction)
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
      dmz: ({ initialPending, externalAction, dmz, address, anvil }) => {
        debug('respondRequest')
        assert(pendingModel.isModel(initialPending))
        assert(dmzModel.isModel(dmz))
        assert(rxRequestModel.isModel(anvil))
        assert(anvil.getAddress().equals(address))
        const isFromBuffer = initialPending.getIsBuffered(anvil)
        const msg = `externalAction can only be responded to by auto resolvers`
        assert(!anvil.equals(externalAction) || isFromBuffer, msg)
        const network = networkProducer.respondRequest(dmz.network, anvil)
        return dmzModel.clone({ ...dmz, network })
      },
    }),
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
    assignDirectMachine: assign((context, event) => {
      const nextContext = { ...context, ...event.data }
      debug(`assignDirectMachine`, detailedDiff(context, nextContext))
      return nextContext
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
      const isSystem =
        dmzReducer.isSystemReply(anvil) || dmzReducer.isSystemRequest(anvil)
      debug(`isSystem: ${isSystem}`)
      return isSystem
    },
    isExternalAction: ({ externalAction, anvil, address }) => {
      // a non loopback external action will be responded to by autoresolvers
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

    isChannelUnavailable: ({ dmz, address }) => {
      assert(addressModel.isModel(address))
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
    isTxOriginPromise: ({ isOriginPromise }) => {
      debug(`isTxOriginPromise`, isOriginPromise)
      return isOriginPromise
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
    direct: async (context) => {
      debug(`direct`)
      const { machine, config } = directConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    pending: async (context) => {
      debug(`pending`)
      const { machine, config } = pendingConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
  },
}

const interpreterConfig = (isolatedTick) => {
  assert.strictEqual(typeof isolatedTick, 'function')
  // TODO multiplex the function with a code, so can use the same machine repeatedly
  const machine = { ...definition, context: { isolatedTick } }
  return { machine, config }
}

module.exports = { interpreterConfig }
