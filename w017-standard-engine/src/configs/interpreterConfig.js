const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter')
const detailedDiff = require('deep-object-diff').detailedDiff
const { pure } = require('../../../w001-xstate-direct')
const {
  rxReplyModel,
  rxRequestModel,
  addressModel,
  dmzModel,
} = require('../../../w015-models')
const { networkProducer } = require('../../../w016-producers')
const dmzReducer = require('../../../w021-dmz-reducer')
const { definition } = require('../machines/interpreter')
const { directConfig } = require('./directConfig')
const { pendingConfig } = require('./pendingConfig')
const { autoResolvesConfig } = require('./autoResolvesConfig')
const { dmzConfig } = require('./dmzConfig')
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
      assert(!event.data.then)
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
    isPending: ({ dmz }) => {
      const isPending = dmz.pending.getIsPending()
      debug(`isPending`, isPending)
      return isPending
    },
  },
  services: {
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
    autoResolves: async (context) => {
      debug(`autoResolves`)
      const { machine, config } = autoResolvesConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      debug(`autoResolves`, detailedDiff(context, nextContext))
      return nextContext
    },
    dmz: async (context) => {
      debug(`dmz`)
      const { machine, config } = dmzConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      debug(`dmz`, detailedDiff(context, nextContext))
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
