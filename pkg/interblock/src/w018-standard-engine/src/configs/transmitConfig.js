import assert from 'assert-fast'
import { assign } from 'xstate'
import { Interblock, Socket, Tx, Address } from '../../../w015-models'
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
          assert(interblock instanceof Interblock)
          debug(`assignInterblock`)
          return interblock
        },
      }),
      extendTargetTxs: assign({
        targetTxs: ({ interblock, targetTxs }, event) => {
          assert(interblock instanceof Interblock)
          assert(Array.isArray(targetTxs))
          assert(targetTxs.every((v) => v instanceof Tx))
          const { sockets } = event.data
          assert(Array.isArray(sockets))
          assert(sockets.every((v) => v instanceof Socket))
          const ext = sockets.map((socket) => Tx.create(socket, interblock))
          const extendedTargetTxs = [...targetTxs, ...ext]
          debug(`extendTargetTxs length`, extendedTargetTxs.length)
          return extendedTargetTxs
        },
      }),
      extendSelfToGenesisAttempt: assign({
        targetTxs: ({ interblock, targetTxs }) => {
          assert(interblock instanceof Interblock)
          assert(interblock.isGenesisAttempt())
          assert(Array.isArray(targetTxs))
          const selfTx = Tx.create(Socket.create(), interblock)
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
        assert(interblock instanceof Interblock)
        const toAddress = interblock.getTargetAddress()
        assert(toAddress instanceof Address)
        const sockets = await consistency.getSockets(toAddress)
        debug(`fetchTargetSockets length: ${sockets.length}`)
        return { sockets }
      },
      fetchSelfTarget: async ({ interblock }) => {
        assert(interblock instanceof Interblock)
        const address = interblock.getTargetAddress()
        assert(address)
        const isSelfTarget = await consistency.getIsPresent(address)
        debug(`fetchSelfTarget isSelfTarget: ${isSelfTarget}`)
        const sockets = isSelfTarget ? [Socket.create()] : []
        return { sockets }
      },
      isOriginPresent: async ({ interblock }) => {
        assert(interblock instanceof Interblock)
        const address = interblock.provenance.getAddress()
        // TODO check validators will be faster and safer
        // TODO cache this call
        const isOriginPresent = await consistency.getIsPresent(address)
        debug(`isOriginPresent service: `, !!isOriginPresent)
        return { isOriginPresent }
      },
    },
  }
  return { machine: transmitMachine, config }
}

export { transmitConfig }
