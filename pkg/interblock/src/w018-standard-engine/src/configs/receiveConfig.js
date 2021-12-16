import assert from 'assert-fast'
import { assign } from 'xstate'
import { txModel, Block, interblockModel } from '../../../w015-models'
import { receiveMachine } from '../machines'
import { toFunctions as consistencyFn } from '../services/consistencyFactory'
import Debug from 'debug'
const debug = Debug('interblock:cfg:receive')

const receiveConfig = (ioConsistency) => {
  const consistency = consistencyFn(ioConsistency)
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
          assert(latest instanceof Block)
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
  return { machine: receiveMachine, config }
}

export { receiveConfig }
