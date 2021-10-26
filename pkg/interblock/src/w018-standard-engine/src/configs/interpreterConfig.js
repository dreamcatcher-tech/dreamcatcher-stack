import assert from 'assert-fast'
import { pure } from '../../../w001-xstate-direct'
import {
  rxReplyModel,
  rxRequestModel,
  addressModel,
  dmzModel,
} from '../../../w015-models'
import { networkProducer } from '../../../w016-producers'
import * as dmzReducer from '../../../w017-dmz-producer'
import { interpreterMachine } from '../machines'
import { directConfig } from './directConfig'
import { pendingConfig } from './pendingConfig'
import { autoResolvesConfig } from './autoResolvesConfig'
import { dmzConfig } from './dmzConfig'
import { assign } from 'xstate'
import Debug from 'debug'
const debug = Debug('interblock:cfg:heart')

const config = {
  actions: {
    assignExternalAction: assign({
      externalAction: (context, event) => {
        const { rxAction } = event.payload
        return rxAction
      },
    }),
    assignDmz: assign({
      dmz: (context, event) => {
        const { dmz } = event.payload
        assert(dmzModel.isModel(dmz))
        return dmz
      },
      initialPending: ({ dmz }, event) => {
        assert.strictEqual(dmz, event.payload.dmz)
        assert(dmzModel.isModel(dmz))
        return dmz.pending
      },
    }),
    assignAnvil: assign({
      anvil: (context, event) => {
        const { rxAction } = event.payload
        const anvil = rxAction
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))
        return anvil
      },
    }),
    loadSelfAnvil: assign({
      anvil: ({ dmz }) => {
        const anvil = dmz.network.rxSelf()
        debug(`loadSelfAnvil anvil: %o`, anvil.type)
        return anvil
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
      debug(`assignDirectMachine`)
      return nextContext
    }),
  },
  guards: {
    isSelfExhausted: ({ dmz }) => {
      assert(dmzModel.isModel(dmz))
      const isSelfExhausted = !dmz.network.rxSelf() // up to here
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
  // TODO move to synchronous where possible, for speed ?
  services: {
    // TODO split out exactly what pieces of context are used in each machine
    direct: async (context) => {
      debug(`direct machine`)
      // const { covenantAction, dmz, anvil,reduceRejection,reduceResolve }
      const { machine, config } = directConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    pending: async (context) => {
      debug(`pending machine`)
      // const {covenantAction, dmz, anvil, reduceResolve, reduceRejection}
      const { machine, config } = pendingConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    autoResolves: async (context) => {
      debug(`autoResolves machine`)
      // TODO move this synchronous machine to an action
      // const {dmz, initialPending, isExternalPromise, externalAction}
      const { machine, config } = autoResolvesConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
    dmz: async (context) => {
      debug(`dmz machine`)
      // const { dmz, reduceResolve, anvil}
      const { machine, config } = dmzConfig(context)
      const nextContext = await pure('EXEC', machine, config)
      return nextContext
    },
  },
}

const interpreterConfig = (isolatedTick) => {
  assert.strictEqual(typeof isolatedTick, 'function')
  // TODO multiplex the function with a code, so can use the same machine repeatedly
  const machine = { ...interpreterMachine, context: { isolatedTick } }
  return { machine, config }
}

export { interpreterConfig }
