import assert from 'assert'
import { actions } from '../../w021-dmz-reducer'
import { Machine, assign } from 'xstate'
import { socketModel, covenantIdModel } from '../../w015-models'
import { tcpTransportFactory } from './tcpTransportFactory'
import { effect, interchain } from '../../w002-api'
import {
  respond,
  send,
  sendParent,
  translator,
} from '../../w022-xstate-translator'
import Debug from 'debug'
const debug = Debug('interblock:covenants:socket')
const { spawn, connect, getChannel } = actions

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
          chainIds = Array.from(set)
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
          chainIds = Array.from(set)
          debug(`chainIds length: %o`, chainIds)
          return chainIds
        },
      }),
      assignRemoteName: assign({
        remoteName: (context, event) => {
          const { remoteName } = event.data
          assert.strictEqual(typeof remoteName, 'string')
          debug(`remoteName`, remoteName)
          return remoteName
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
        const { remoteName } = await interchain(getChannel('..'))
        debug(`remoteName: %O`, remoteName)
        const url = remoteName.replace(/\|/g, '/')
        debug(`url: %O`, url)

        const tcpTransport = gateway[remoteName] || tcpTransportFactory(url)
        gateway[remoteName] = tcpTransport
        const result = await effect('CONNECT', tcpTransport.connect)
        debug(`connected to %o`, url)
        // TODO do a version check
        return { remoteName, ...result }
      },
      ping: async ({ remoteName }, event) => {
        assert.strictEqual(typeof remoteName, 'string')
        debug(`ping: %O`, event)
        const tcpTransport = gateway[remoteName]
        if (!tcpTransport) {
          throw new Error(`No socket found for: ${remoteName}`)
        }
        const result = await effect(
          'PING',
          tcpTransport.ping,
          event.payload.data
        )
        debug(`ping result: %O`, result)
        return result
      },
      disconnectSocket: async ({ remoteName }, event) => {
        debug(`disconnectSocket`)
        const tcpTransport = gateway[remoteName]
        if (!tcpTransport) {
          throw new Error(`No socket found for: ${remoteName}`)
        }
        const result = await effect('DISCONNECT', tcpTransport.disconnect)
        delete gateway[remoteName]
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
        remoteName: '',
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
              actions: ['assignRemoteName', 'respondOrigin'],
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

export { socketFactory }
