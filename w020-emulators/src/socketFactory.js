const debug = require('debug')('interblock:covenants:socket')
const assert = require('assert')
const dmzReducer = require('../../w021-dmz-reducer')
const { Machine, assign } = require('xstate')
const { spawn, connect, getGivenName } = dmzReducer.actions
const { socketModel, covenantIdModel } = require('../../w015-models')
const { tcpTransportFactory } = require('./tcpTransportFactory')
const { effect, interchain } = require('../../w002-api')
const {
  respond,
  send,
  sendParent,
  translator,
} = require('../../w022-xstate-translator')

const socketFactory = (gateway) => {
  const config = {
    actions: {
      addChainId: assign({
        chainIds: ({ chainIds }, event) => {
          assert(Array.isArray(chainIds))
          const set = new Set(chainIds)
          const { chainId } = event.payload
          assert.strictEqual(typeof chainId, 'string')
          set.add(chainId)
          chainIds = [...set]
          debug(`chainIds length: %o`, chainIds)
          return chainIds
        },
      }),
      rmChainId: assign({
        chainIds: ({ chainIds }, event) => {
          assert(Array.isArray(chainIds))
          const set = new Set(chainIds)
          const { chainId } = event.payload
          assert.strictEqual(typeof chainId, 'string')
          set.delete(chainId)
          chainIds = [...set]
          debug(`chainIds length: %o`, chainIds)
          return chainIds
        },
      }),
      assignGivenName: assign({
        givenName: (context, event) => {
          const { givenName } = event.data
          assert.strictEqual(typeof givenName, 'string')
          debug(`givenName`, givenName)
          return givenName
        },
      }),
      respondPing: (context, event) => {
        debug(`respondPing`, event)
        return respond(event.data)
      },
      respondOrigin: (context, event) => respond(event.data),
    },
    guards: {},
    services: {
      connectSocket: async (context, event) => {
        // TODO handle duplicate additions gracefully
        debug(`connectSocket`)
        const { givenName } = await interchain(getGivenName())
        debug(`givenName: %O`, givenName)
        const url = givenName.replace(/\|/g, '/')
        debug(`url: %O`, url)

        const tcpTransport = gateway[givenName] || tcpTransportFactory(url)
        gateway[givenName] = tcpTransport
        const result = await effect('CONNECT', tcpTransport.connect)
        debug(`connected to %o`, url)
        // TODO do a version check
        return { givenName, ...result }
      },
      ping: async ({ givenName }, event) => {
        assert.strictEqual(typeof givenName, 'string')
        debug(`ping: %O`, event)
        const tcpTransport = gateway[givenName]
        if (!tcpTransport) {
          throw new Error(`No socket found for: ${givenName}`)
        }
        const result = await effect(
          'PING',
          tcpTransport.ping,
          event.payload.data
        )
        debug(`ping result: %O`, result)
        return result
      },
      disconnectSocket: async ({ givenName }, event) => {
        debug(`disconnectSocket`)
        const tcpTransport = gateway[givenName]
        if (!tcpTransport) {
          throw new Error(`No socket found for: ${givenName}`)
        }
        const result = await effect('DISCONNECT', tcpTransport.disconnect)
        delete gateway[givenName]
        debug(`disconnectSocket result: `, result)
        return { ...result }
      },
    },
  }
  const machine = Machine(
    {
      id: 'socket',
      initial: 'idle',
      context: {
        chainIds: [],
        givenName: '',
      },
      strict: true,
      states: {
        idle: {
          on: {
            ADD: 'addChainId',
            CONNECT: 'connectSocket',
            DISCONNECT: 'disconnectSocket',
            PING: 'ping',
            PING_LAMBDA: 'pingLambda',
            VERSION: 'version',
            RM: 'rmChainId',
            TRANSMIT: 'transmitInterblock',
          },
        },
        addChainId: { entry: 'addChainId', always: 'idle' },
        connectSocket: {
          invoke: {
            src: 'connectSocket',
            onDone: {
              target: 'idle',
              actions: ['assignGivenName', 'respondOrigin'],
            },
          },
        },
        disconnectSocket: {
          invoke: {
            src: `disconnectSocket`,
            onDone: { target: 'idle', actions: 'respondOrigin' },
          },
        },
        ping: {
          invoke: {
            src: `ping`,
            onDone: { target: 'idle', actions: 'respondPing' },
          },
        },
        pingLambda: {
          invoke: { src: `pingLambda`, onDone: 'idle' },
        },
        version: {
          invoke: { src: `version`, onDone: 'idle' },
        },
        rmChainId: { entry: 'rmChainId', always: 'idle' },
        transmitInterblock: {
          invoke: { src: 'transmitInterblock', onDone: 'idle' },
        },
        done: {
          id: 'done',
          type: 'final',
        },
        error: {
          id: 'error',
          type: 'final',
        },
      },
    },
    config
  )

  const actions = {
    addChainId: (chainId) => ({
      type: 'ADD',
      payload: { chainId },
    }),
    connect: () => ({ type: 'CONNECT' }),
    disconnect: () => ({ type: 'DISCONNECT' }),
    ping: (data = '') => ({ type: 'PING', payload: { data } }),
    pingLambda: () => ({ type: 'PING_LAMBDA' }),
    version: () => ({ type: 'VERSION' }),
    rmChainId: (chainId) => ({ type: 'RM', payload: { chainId } }),
    transmit: (interblock) => ({ type: 'TRANSMIT', payload: { interblock } }),
  }

  const schemas = {}

  const reducer = translator(machine)
  const covenantId = covenantIdModel.create('socket')
  return { actions, schemas, reducer, covenantId }
}

module.exports = { socketFactory }
