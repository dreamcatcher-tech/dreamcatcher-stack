import assert from 'assert-fast'
import { RxReply, RxRequest, Dmz, reductionModel } from '../../../w015-models'
import { _hook as hook } from '../../../w002-api'
import { dmzMachine } from '../machines'
import { common } from './common'
import { assign } from 'xstate'
import Debug from 'debug'
import { dmzProducer } from '../../../w016-producers'
import * as dmzReducer from '../../../w017-dmz-producer'
const debug = Debug('interblock:cfg:dmz')

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
        assert(dmz instanceof Dmz)
        assert(reductionModel.isModel(reduceResolve))
        debug('mergeSystemState')
        return Dmz.clone(reduceResolve.reduction)
      },
    }),
    respondLoopbackRequest,
    assignResolve,
    transmit,
    resolveAccumulator: assign({
      dmz: ({ dmz }) => {
        assert(dmz instanceof Dmz)
        if (!dmz.pending.getIsPending()) {
          debug('resolveAccumulator not pending')
          return dmz
        }
        debug(`resolveAccumulator is pending`)
        return dmzProducer.accumulate(dmz)
      },
    }),
    assignRejection,
    respondRejection,
    warnReplyRejection: ({ reduceRejection }) => {
      // TODO reject all loopback actions and reject the external action
      debug(`warnReplyRejection dmz`)
      // console.error(reduceRejection)
    },
  },
  guards: {
    isChannelUnavailable: ({ dmz, anvil }) => {
      // TODO may merge with the autoResolve test if action is present ?
      assert(dmz instanceof Dmz)
      assert(anvil instanceof RxRequest)
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
      assert(dmz instanceof Dmz)
      assert(anvil instanceof RxRequest || anvil instanceof RxReply)
      debug(`reduceSystem anvil: %o`, anvil.type)
      // TODO move to be same code as isolateFactory
      const tick = () => dmzReducer.reducer(dmz, anvil)
      const reduceResolve = await hook(tick)

      assert(reduceResolve, `System returned: ${reduceResolve}`)
      assert(!reduceResolve.isPending, `System can never raise pending`)
      const { transmissions } = reduceResolve
      debug(`reduceSystem txs: ${transmissions.length}`)
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
