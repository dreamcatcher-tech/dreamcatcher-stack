import assert from 'assert-fast'
import {
  rxReplyModel,
  rxRequestModel,
  dmzModel,
  reductionModel,
  addressModel,
} from '../../../w015-models'
import * as dmzProducer from '../../../w017-dmz-producer'
import { _hook as hook } from '../../../w002-api'
import { dmzMachine } from '../machines'
import { common } from './common'
import { assign } from 'xstate'
import Debug from 'debug'
const debug = Debug('interblock:cfg:heart:dmz')

const {
  transmit,
  assignResolve,
  isReply,
  assignRejection,
  respondRejection,
  respondLoopbackRequest,
  isLoopbackResponseDone,
  isAnvilNotLoopback,
} = common(debug)

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
    assignRejection,
    respondRejection,
  },
  guards: {
    isChannelUnavailable: ({ dmz, anvil }) => {
      // TODO may merge with the autoResolve test if action is present ?
      assert(dmzModel.isModel(dmz))
      assert(rxRequestModel.isModel(anvil))
      const address = anvil.getAddress()
      const isChannelUnavailable = !dmz.network.getAlias(address)
      debug(`isChannelUnavailable: `, isChannelUnavailable)
      return isChannelUnavailable
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
      const tick = () => dmzProducer.reducer(dmz, anvil)
      const accumulator = []
      const salt = `TODO` // TODO make salt depend on something else, like the io channel index
      const reduceResolve = await hook(tick, accumulator, salt)

      assert(reduceResolve, `System returned: ${reduceResolve}`)
      assert(!reduceResolve.isPending, `System can never raise pending`)
      const { requests, replies } = reduceResolve
      debug(`reduceSystem req: ${requests.length} rep: ${replies.length}`)
      return { reduceResolve }
    },
  },
}

const dmzConfig = (context) => {
  assert.strictEqual(typeof context, 'object')
  const machine = { ...dmzMachine, context }
  return { machine, config }
}

export { dmzConfig }
