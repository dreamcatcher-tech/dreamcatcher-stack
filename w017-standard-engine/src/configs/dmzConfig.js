const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter.dmzConfig')
const {
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  pendingModel,
  reductionModel,
  addressModel,
} = require('../../../w015-models')
const dmzReducer = require('../../../w021-dmz-reducer')
const {
  '@@GLOBAL_HOOK_INBAND': globalHookInband,
} = require('../../../w002-api')
const { networkProducer } = require('../../../w016-producers')
const { definition } = require('../machines/dmz')
const {
  transmit,
  respondReply,
  assignResolve,
  isReply,
  assignRejection,
  respondRejection,
} = require('./interpreterCommonConfigs')
const { assign } = require('xstate')

const config = {
  actions: {
    mergeSystemState: assign({
      dmz: ({ dmz, reduceResolve }) => {
        assert(dmzModel.isModel(dmz))
        assert(reductionModel.isModel(reduceResolve))
        debug('mergeSystemState')
        return dmzModel.clone(reduceResolve.reduction)
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
    assignResolve,
    transmit,
    respondReply,
    assignRejection,
    respondRejection,
  },
  guards: {
    isExternalAction: ({ externalAction, anvil, address }) => {
      // a non loopback external action will be responded to by autoresolvers
      assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
      assert(addressModel.isModel(address))
      const isExternalAction = !address.isLoopback()
      assert(!isExternalAction || externalAction.equals(anvil))
      debug(`isExternalAction`, isExternalAction)
      return isExternalAction
    },
    isChannelUnavailable: ({ dmz, address }) => {
      // TODO may merge with the autoResolve test if action is present ?
      assert(addressModel.isModel(address))
      assert(!address.isUnknown(), `Address unknown`)
      const alias = dmz.network.getAlias(address)
      debug(`isChannelUnavailable: `, !alias)
      return !alias
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
    isReply,
  },
  services: {
    // TODO move this to synchronous as soon as genesis is synchronous
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
  },
}

const dmzConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...definition, context }
  return { machine, config }
}

module.exports = { dmzConfig }
