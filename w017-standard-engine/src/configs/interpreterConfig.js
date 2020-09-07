const assert = require('assert')
const debug = require('debug')('interblock:config:interpreter')
const {
  rxReplyModel,
  rxRequestModel,
  addressModel,
  stateModel,
  dmzModel,
} = require('../../../w015-models')
const { networkProducer } = require('../../../w016-producers')
const dmzReducer = require('../../../w021-dmz-reducer')
const { machine } = require('../machines/interpreter')
const { assign } = require('xstate')

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
  return machine.withContext({ dmz, anvil, address }).withConfig({
    actions: {
      assignRejection: assign({
        reduceRejection: (context, event) => event.data,
      }),
      assignResolve: assign({
        reduceResolve: (context, event) => event.data,
      }),
      mergeSystem: assign({
        dmz: ({ reduceResolve }) => {
          debug('mergeSystem')
          assert(stateModel.isModel(reduceResolve))
          const dmz = dmzModel.clone(reduceResolve.getState())
          const network = networkProducer.tx(dmz.network, reduceResolve)
          // TODO check if moving channels around inside dmz can affect tx ?
          return dmzModel.clone({ ...dmz, network })
        },
      }),
      // TODO both merges do a network tx, then different merges to dmz - unify these
      mergeCovenant: assign({
        dmz: ({ dmz, reduceResolve }) => {
          assert(stateModel.isModel(reduceResolve))
          assert(dmzModel.isModel(dmz))
          const reqLength = reduceResolve.getRequests().length
          const repLength = reduceResolve.getReplies().length
          debug('mergeCovenant requests: %o replies %o', reqLength, repLength)
          const network = networkProducer.tx(dmz.network, reduceResolve)
          const state = reduceResolve.getState()
          return dmzModel.clone({ ...dmz, state, network })
        },
      }),
      respondReply: assign({
        dmz: ({ dmz, address }) => {
          debug('respondReply')
          assert(dmzModel.isModel(dmz))
          const network = networkProducer.respondReply(dmz.network, address)
          return dmzModel.clone({ ...dmz, network })
        },
      }),
      respondRejection: assign({
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
      isSystem: ({ anvil, address }) => {
        // TODO move to statechart conditions
        if (anvil.type === '@@TIMESTAMP') {
          return false
        }
        assert(addressModel.isModel(address))
        assert(rxRequestModel.isModel(anvil) || rxReplyModel.isModel(anvil))

        if (anvil.isReply()) {
          const isSystem = dmzReducer.isSystemReply(anvil)
          debug(`isSystem: ${isSystem}`)
          return isSystem
        } else {
          const isSystem = dmzReducer.isSystemRequest(anvil)
          debug(`isSystem: ${isSystem}`)
          return isSystem
        }
      },
      isChannelUnavailable: ({ anvil, dmz, address }) => {
        if (anvil.type === '@@TIMESTAMP') {
          debug(`isChannelUnavailable: `, true)
          return true
        }
        assert(addressModel.isModel(address), `If Anvil, then address required`)
        assert(!address.isUnknown(), `Address unknown`)
        const alias = dmz.network.getAlias(address)
        debug(`isChannelUnavailable: `, !alias)
        return !alias
      },
      isReply: ({ anvil }) => {
        assert(anvil)
        debug(`isReply type: ${anvil.type} isReply: ${anvil.isReply()}`)
        return anvil.isReply()
      },
      isRejection: ({ reduceRejection }) => {
        debug(`isRejection ${!!reduceRejection}`)
        if (reduceRejection) {
          debug(reduceRejection.message)
        }
        return reduceRejection
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
      reduceCovenant: async ({ dmz, anvil }) => {
        debug(`reduceCovenant anvil: %o`, anvil.type)
        assert(anvil)
        const state = dmz.state.getState()
        const result = await isolatedTick(state, anvil)
        assert(result, `Covenant returned: ${result}`)
        const nextState = stateModel.create(result, anvil)
        return nextState
      },
      reduceSystem: async ({ dmz, anvil }) => {
        debug(`reduceSystem anvil: %o`, anvil.type)
        assert(anvil)
        const result = await dmzReducer.reducer(dmz, anvil)
        assert(result, `System returned: ${result}`)
        const nextState = stateModel.create(result, anvil)
        assert(dmzModel.clone(nextState.getState()), `Uncloneable dmz`)
        return nextState
      },
    },
  })
}

module.exports = { interpreterConfig }
