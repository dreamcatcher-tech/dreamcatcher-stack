import assert from 'assert'
import Debug from 'debug'
const debug = Debug('interblock:cfg:receive')
const { assign } = require('xstate')
const {
  lockModel,
  addressModel,
  txModel,
  blockModel,
  interblockModel,
} = require('../../../w015-models')
const {
  blockProducer,
  lockProducer,
  networkProducer,
} = require('../../../w016-producers')
const { definition } = require('../machines/receive')
const consistencyProcessor = require('../services/consistencyFactory')

const receiveConfig = (ioConsistency) => {
  const consistency = consistencyProcessor.toFunctions(ioConsistency)
  const config = {
    actions: {
      assignInterblock: assign({
        interblock: (context, event) => {
          const tx = event.payload
          assert(txModel.isModel(tx))
          return tx.interblock
        },
      }),
      assignSocket: assign({
        socket: (context, event) => {
          const tx = event.payload
          assert(txModel.isModel(tx))
          return tx.socket
        },
      }),
      assignIsPoolable: assign({
        isPoolable: (context, event) => true,
      }),
    },
    guards: {
      isInitialConditions: (context, event) => {
        const isInitialConditions = event.data
        debug(`isInitialConditions: ${isInitialConditions}`)
        return isInitialConditions
      },
      isPoolable: (context, event) => {
        const isPoolable = event.data
        assert(typeof isPoolable === 'boolean')
        debug(`isPoolable: ${isPoolable}`)
        return isPoolable
      },
      isConnectionAttempt: ({ interblock }) => interblock.isConnectionAttempt(),
      isConnectable: (context, event) => event.data,
    },
    services: {
      isInitialConditions: async () => {
        const blankAddress = undefined
        const base = await consistency.getBlock({
          address: blankAddress,
        })
        debug(`isInitialConditions: ${!base}`)
        return !base
      },
      isAnyAffected: async ({ interblock }) => {
        const isAnyAffected = await consistency.getIsAnyAffected(interblock)
        debug(`isAnyAffected: ${isAnyAffected}`)
        return isAnyAffected
      },
      isConnectable: async ({ interblock }) => {
        // TODO merge with same function in poolConfig
        assert(interblockModel.isModel(interblock))
        const address = interblock.getTargetAddress()
        assert(address)
        const latest = await consistency.getBlock({ address })
        if (latest) {
          assert(blockModel.isModel(latest))
        }
        const isConnectable = latest && latest.config.isPublicChannelOpen
        debug(`isConnectable: `, isConnectable)
        return isConnectable
      },
      // TODO WARNING must handshake to prove worthy of receipt
      storeConnection: async ({ interblock, socket }) => {
        debug(`storeConnection`)
        const address = interblock.provenance.getAddress()
        await consistency.putSocket({ address, socket })
      },
    },
  }
  return { machine: definition, config }
}

module.exports = { receiveConfig }
