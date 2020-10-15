const debug = require('debug')('interblock:covenants:socket')
const assert = require('assert')
const dmzReducer = require('../../w021-dmz-reducer')
const { Machine, assign } = require('xstate')
const { spawn, connect } = dmzReducer.actions
const { socketModel } = require('../../w015-models')
const {
  respond,
  send,
  sendParent,
  invoke,
  translator,
} = require('../../w022-xstate-translator')

const socketFactory = (gateway) => {
  const config = {
    actions: {
      addChainId: assign({
        chainIds: ({ chainIds }, event) => {
          assert(Array.isArray(chainIds))
          const { chainId } = event.payload
          assert(typeof chainId === 'string')
          chainIds = [...chainIds, chainId]
          debug(`chainIds length: %o`, chainIds)
          return chainIds
        },
      }),
    },
    guards: {},
    services: {
      addChainId: async (context, event) => {
        // TODO handle duplicate additions gracefully
        debug(`addChainId %O`, event)
        return
        assert.strictEqual(typeof socketInfo, 'object')
        assert.strictEqual(typeof chainId, 'string')
        assert.strictEqual(typeof socketInfo.url, 'string')
        const { url } = socketInfo
        const tcpTransport = tcpTransportFactory(url)
        await tcpTransport.connect()
        debug(`connected to %o`, url)
        const latency = await tcpTransport.pingLambda() // TODO do a version check too
        debug(`latency of %o ms to %o `, latency, url)

        const address = addressModel.create(chainId)

        const socket = socketModel.create({
          type: 'awsApiGw',
          info: socketInfo,
        })
        const action = { type: 'PUT_SOCKET', payload: { address, socket } }
        await ioConsistency.push(action)
        return latency
      },
      rmTransport: async () => {
        // close all the websockets
        // reset the sqs queues back to defaults
      },
      ping: async (context, event) => {
        // if ping '.' respond, else engage in remote pinging
        debug(`ping: %O`, event)
        const { type, payload } = event
        const { to, ...rest } = payload
        assert(type === 'PING')
        if (to === '.') {
          debug(`ping to self`)
          return { type: 'PONG', payload: rest } // TODO move to state machine
        }
        const result = await invoke(type, {}, to)
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
      id: 'net',
      initial: 'idle',
      context: {
        chainIds: [],
        type: '',
        url: '',
      },
      strict: true,
      states: {
        idle: {
          on: {
            '@@INIT': 'idle',
            ADD: 'addChainId',
            RM: 'rmTransport',
            PING: 'ping',
            PING_LAMBDA: 'pingLambda',
            VERSION: 'version',
          },
        },
        addChainId: {
          entry: 'addChainId',
          always: 'idle',
        },
        rmTransport: {
          invoke: {
            src: `addTransport`,
            onDone: 'idle',
          },
        },
        ping: {
          invoke: {
            src: `addTransport`,
            onDone: 'idle',
          },
        },
        pingLambda: {
          invoke: {
            src: `addTransport`,
            onDone: 'idle',
          },
        },
        version: {
          invoke: {
            src: `addTransport`,
            onDone: 'idle',
          },
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
    connect: () => {},
    disconnect: () => {},
    ping: () => {},
    pingLambda: () => {},
    version: () => {},
    rmChainId: () => {},
  }

  const schemas = {
    ping: {
      description: `Ping the transport, or the function.  Pings to chain are handled by the chain directly`,
    },
  }

  const reducer = translator(machine)
  return { actions, schemas, reducer }
}

module.exports = { socketFactory }
