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
        const result = await effect(
          'PING',
          tcpTransport.ping,
          event.payload.data
        )
        debug(`ping result: %O`, result)
        return result
      },
      login: async (context, event) => {
        debug(`login: %O`, event.payload.terminal)
        const { chainId, ...rest } = event.payload
        // TODO check terminal regex is a chainId
        const connectToTerminal = connect('terminal', chainId)
        await invoke(connectToTerminal)

        // TODO import from authenticator / terminal functions
        const loginResult = await invoke('@@INTRO', rest, 'terminal')
        debug(`loginResult: %O`, loginResult)
        return { loginResult }
      },
      addActor: async (context, event) => {
        assert.strictEqual(typeof event.payload, 'object')
        const { alias, spawnOptions, to } = event.payload
        debug(`addActor`, alias, to)
        const { type, payload } = spawn(alias, spawnOptions)
        const addActor = await invoke(type, payload, to)

        // calculate path based on working directory

        // TODO if this was remote, open a path to the child ?
        // but don't transmit anything ?
        return { addActor }
      },
      listActors: async (context, event) => {},
      changeDirectory: async (context, event) => {
        const { path } = event.payload
        debug(`changeDirectory`, path)
        assert.strictEqual(typeof path, 'string')

        // walk the path, checking with self if each path exists

        // if path doesn't exist, need to open it

        // if fail to open, reject
      },
      removeActor: async (context, event) => {
        debug(`removeActor`, event)
        // refuse to delete self
        // try open path to child
      },
    },
  }
  const machine = Machine(
    {
      id: 'socket',
      initial: 'idle',
      context: {
        chainIds: [],
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
          invoke: { src: `disconnectSocket`, onDone: 'idle' },
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
    ping: (data) => ({ type: 'PING', payload: { data } }),
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
