import assert from 'assert'
import Debug from 'debug'
const debug = Debug('interblock:cfg:heart:dmz')
const {
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  reductionModel,
  addressModel,
} = require('../../../w015-models')
const dmzReducer = require('../../../w021-dmz-reducer')
const { '@@GLOBAL_HOOK': hook } = require('../../../w002-api')
const { definition } = require('../machines/dmz')
const { common } = require('./common')
const {
  transmit,
  respondReply,
  assignResolve,
  isReply,
  assignRejection,
  respondRejection,
  respondLoopbackRequest,
  isLoopbackResponseDone,
  isAnvilNotLoopback,
} = common(debug)
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
    respondLoopbackRequest,
    assignResolve,
    transmit,
    respondReply,
    assignRejection,
    respondRejection,
  },
  guards: {
    isChannelUnavailable: ({ dmz, address }) => {
      // TODO may merge with the autoResolve test if action is present ?
      // TODO remove address once have address is replies
      assert(dmzModel.isModel(dmz))
      assert(addressModel.isModel(address))
      assert(!address.isUnknown(), `Address unknown`)
      const alias = dmz.network.getAlias(address)
      debug(`isChannelUnavailable: `, !alias)
      return !alias
    },
    isReply,
    isLoopbackResponseDone,
    isAnvilNotLoopback,
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
      const reduceResolve = await hook(tick, accumulator, salt)

      assert(reduceResolve, `System returned: ${reduceResolve}`)
      assert(!reduceResolve.isPending, `System can never raise pending`)
      const { requests, replies } = reduceResolve
      debug(`reduceSystem tx: ${requests.length} rx: ${replies.length}`)
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
