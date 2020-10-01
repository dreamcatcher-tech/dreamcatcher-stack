const assert = require('assert')
const debug = require('debug')('interblock:config:transmit')
const _ = require('lodash')
const { assign } = require('xstate')
const {
  interblockModel,
  blockModel,
  socketModel,
  txModel,
  addressModel,
} = require('../../../w015-models')
const { machine } = require('../machines/transmit')
const consistencyProcessor = require('../services/consistencyFactory')

const transmitConfig = (ioConsistency) => {
  const consistency = consistencyProcessor.toFunctions(ioConsistency)
  return machine.withConfig({
    actions: {
      assignInterblock: assign({
        interblock: (context, event) => {
          const interblock = event.payload
          debug(`assignInterblock`)
          assert(interblockModel.isModel(interblock))
          return interblock
        },
      }),
      assignBlock: assign({
        block: (context, event) => {
          const { block } = event.data
          assert(blockModel.isModel(block))
          return block
        },
      }),
      extendListeningTxs: assign({
        listeningTxs: ({ interblock, listeningTxs }, event) => {
          debug(`extendListeningTxs`)
          const { sockets } = event.data
          assert(sockets.every(socketModel.isModel))
          const light = interblock.getWithoutRemote()
          const ext = sockets.map((socket) => txModel.create(socket, light))
          return [...listeningTxs, ...ext]
        },
      }),
      extendTargetTxs: assign({
        targetTxs: ({ interblock, targetTxs }, event) => {
          debug(`assignTargetTxs`)
          const sockets = event.data
          assert(sockets.every(socketModel.isModel))
          const ext = sockets.map((socket) =>
            txModel.create(socket, interblock)
          )
          return [...targetTxs, ...ext]
        },
      }),
      assignLineage: assign({
        lineage: (context, event) => event.data,
      }),
      assignSelfTarget: assign({
        targetTxs: ({ targetTxs, interblock }) => {
          const selfSocket = socketModel.create()
          const tx = txModel.create(selfSocket, interblock)
          const nextTargetTxs = [...targetTxs, tx]
          debug(`assignSelfTarget targetTxs length: ${nextTargetTxs.length}`)
          return nextTargetTxs
        },
      }),
      extendLineageTxs: assign({
        lineageTxs: ({ targetTxs, lineage }) => {
          debug(`extendLineageTxs`)
          assert(lineage.every(interblockModel.isModel))
          assert(lineage.every((interblock) => !interblock.getTargetAddress()))
          const lineageTxs = []
          targetTxs.forEach((tx) => {
            lineage.forEach((interblock) => {
              assert(txModel.isModel(tx))
              const { socket } = tx
              assert(socketModel.isModel(socket))
              lineageTxs.push(txModel.create(socket, interblock))
            })
          })
          debug(`extendLineageTxs generated ${lineageTxs.length} extensions`)
          return lineageTxs
        },
      }),
      extendGenesisAttempt: assign({
        targetTxs: ({ interblock, targetTxs }) => {
          assert(interblockModel.isModel(interblock))
          assert(interblock.isGenesisAttempt())
          const selfTx = txModel.create(socketModel.create(), interblock)
          targetTxs = [...targetTxs, selfTx]
          return targetTxs
        },
      }),
      removeListeningTxs: assign({
        // TODO merge with assignLineageSockets
        listeningTxs: ({ listeningTxs, targetTxs }) => {
          debug(`removeListeningTxs`)
          const targetSockets = targetTxs.map(({ socket }) => socket)
          const filtered = listeningTxs.filter(
            ({ socket }) => !targetSockets.some((ts) => ts.equals(socket))
          )
          debug(`filter removed: ${targetSockets.length - filtered.length}`)
          return filtered
        },
      }),
      mergeTransmissions: assign({
        transmissions: ({ listeningTxs, targetTxs, lineageTxs }) => [
          ...listeningTxs,
          ...lineageTxs,
          ...targetTxs,
        ],
      }),
    },
    guards: {
      isBlockFetched: (context, event) => blockModel.isModel(event.data.block),
      isLineageInterblock: ({ interblock }) => !interblock.getRemote(),
      isInitiatingAction: ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const isResponse = interblock.isConnectionResponse()
        const isResolve = interblock.isConnectionResolve()
        const isDownlinkInit = interblock.isDownlinkInit()
        const isUplinkInit = interblock.isUplinkInit()
        return isResponse || isResolve || isDownlinkInit || isUplinkInit
      },
      isGenesisAttempt: ({ interblock }) => interblock.isGenesisAttempt(),
      isOriginPresent: (context, event) => event.data.isOriginPresent,
    },
    services: {
      /**
       * Stages:
       *  1. map all sockets to lineage interblock
       *  2. overwrite target sockets with heavy interblock
       *  3. extend target sockets with catchup lineage
       *  4. convert to (socket: interblock) pairs, for return.
       */
      fetchBlock: async ({ interblock }) => {
        // TODO use broadcast table ?
        assert(interblockModel.isModel(interblock))
        const block = await consistency.getBlock(interblock.provenance)
        assert(blockModel.isModel(block))
        assert(block.provenance.equals(interblock.provenance))
        debug(`fetchBlock height: ${block.provenance.height}`)
        return { block }
      },
      fetchRemoteListeners: async ({ interblock, block }) => {
        assert(interblockModel.isModel(interblock))
        assert(!interblock.getRemote())
        assert(blockModel.isModel(block))
        const { network } = block
        const awaits = network.getResolvedAliases().map((alias) => {
          const { address } = network[alias]
          const socketsPromise = consistency.getSockets(address)
          return socketsPromise
        })
        const socketsAll = await Promise.all(awaits)
        const flat = _.flatten(socketsAll)
        const socketsSet = new Set(flat)
        debug(`fetchListeningSockets length: ${socketsSet.size}`)
        const sockets = [...socketsSet]
        assert(sockets.every(socketModel.isModel))
        return { sockets }
      },
      fetchSelfListener: async ({ interblock, block }) => {
        // TODO use broadcast table
        assert(interblockModel.isModel(interblock))
        assert(blockModel.isModel(block))
        const { network } = block
        const awaits = network.getResolvedAliases().map((alias) => {
          const { address } = network[alias]
          return consistency.getIsPresent(address)
        })
        const isSelfListening = await Promise.race(awaits)
        debug(`fetchSelfListener: ${isSelfListening}`)
        const sockets = isSelfListening ? [socketModel.create()] : []
        return { sockets }
      },
      fetchRemoteTargets: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const toAddress = interblock.getTargetAddress()
        assert(addressModel.isModel(toAddress))
        const sockets = await consistency.getSockets(toAddress)
        debug(`fetchTargetSockets length: ${sockets.length}`)
        return sockets
      },
      fetchSelfTarget: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const address = interblock.getTargetAddress()
        assert(address)
        const isSelfTarget = await consistency.getIsPresent(address)
        debug(`fetchSelfTarget: ${isSelfTarget}`)
        return isSelfTarget ? [socketModel.create()] : []
      },
      fetchLineageToGenesis: async ({ interblock }) => {
        // TODO limit max number of lineages we will return
        assert(interblockModel.isModel(interblock))
        const height = 0
        // TODO handle missing heavy too - need latest heavy
        debug(`fetchLineage from height: ${height}`)
        const { provenance } = interblock
        const payload = { provenance, height }
        const lineage = await consistency.getLineage(payload)
        debug(`fetchLineage length: ${lineage.length}`)
        return lineage
      },
      isOriginPresent: async ({ interblock }) => {
        assert(interblockModel.isModel(interblock))
        const address = interblock.provenance.getAddress()
        const isOriginPresent = await consistency.getIsPresent(address)
        debug(`isOriginPresent: `, isOriginPresent)
        return { isOriginPresent }
      },
    },
  })
}

module.exports = { transmitConfig }
