import assert from 'assert-fast'
import flatten from 'lodash.flatten'
import { assign } from 'xstate'
import {
  interblockModel,
  socketModel,
  txModel,
  addressModel,
} from '../../../w015-models'
import { transmitMachine } from '../machines'
import { toFunctions as consistencyFn } from '../services/consistencyFactory'
import Debug from 'debug'
const debug = Debug('interblock:cfg:transmit')

const transmitConfig = (ioConsistency) => {
  const consistency = consistencyFn(ioConsistency)
  const config = {
    actions: {
      assignInterblock: assign({
        interblock: (context, event) => {
          const interblock = event.payload
          assert(interblockModel.isModel(interblock))
          debug(`assignInterblock`)
          return interblock
        },
      }),
      extendTargetTxs: assign({
        targetTxs: ({ interblock, targetTxs }, event) => {
          assert(interblockModel.isModel(interblock))
          assert(Array.isArray(targetTxs))
          assert(targetTxs.every(txModel.isModel))
          const { sockets } = event.data
          assert(Array.isArray(sockets))
          assert(sockets.every(socketModel.isModel))
          const ext = sockets.map((socket) =>
            txModel.create(socket, interblock)
          )
          const extendedTargetTxs = [...targetTxs, ...ext]
          debug(`extendTargetTxs length`, extendedTargetTxs.length)
          return extendedTargetTxs
        },
      }),
      extendSelfToGenesisAttempt: assign({
        targetTxs: ({ interblock, targetTxs }) => {
          assert(interblockModel.isModel(interblock))
          assert(interblock.isGenesisAttempt())
          assert(Array.isArray(targetTxs))
          const selfTx = txModel.create(socketModel.create(), interblock)
          targetTxs = [...targetTxs, selfTx]
          debug(`extendSelfToGenesisAttempt tx count:`, targetTxs.length)
          return targetTxs
        },
      }),
    },
    guards: {
      isGenesisAttempt: ({ interblock }) => {
        const isGenesisAttempt = interblock.isGenesisAttempt()
        debug(`isGenesisAttempt`, isGenesisAttempt)
        return isGenesisAttempt
      },
      isOriginPresent: (context, event) => {
        const isOriginPresent = !!event.data.isOriginPresent
        debug(`isOriginPresent`, isOriginPresent)
        return isOriginPresent
      },
    },
    services: {
      fetchRemoteTargets: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const toAddress = interblock.getTargetAddress()
        assert(addressModel.isModel(toAddress))
        const sockets = await consistency.getSockets(toAddress)
        debug(`fetchTargetSockets length: ${sockets.length}`)
        return { sockets }
      },
      fetchSelfTarget: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const address = interblock.getTargetAddress()
        assert(address)
        const isSelfTarget = await consistency.getIsPresent(address)
        debug(`fetchSelfTarget isSelfTarget: ${isSelfTarget}`)
        const sockets = isSelfTarget ? [socketModel.create()] : []
        return { sockets }
      },
      isOriginPresent: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const address = interblock.provenance.getAddress()
        // TODO check validators will be faster and safer
        const isOriginPresent = await consistency.getIsPresent(address)
        debug(`isOriginPresent service: `, !!isOriginPresent)
        return { isOriginPresent }
      },
    },
  }
  return { machine: transmitMachine, config }
}

export { transmitConfig }
