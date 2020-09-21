const debug = require('debug')('interblock:covenants:net')
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

const config = {
  actions: {},
  guards: {},
  services: {
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
    context: {},
    strict: true,
    states: {
      idle: {
        on: {
          '@@INIT': 'idle',
          ADD: 'addTransport',
          RM: 'rmTransport',
          PING: 'ping',
        },
      },
      addTransport: {
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
  ADD: ({ name, socketType, url }) => {
    // example of overriding 'add' function
    // check the schema ?
    return {
      type: `ADD`,
      payload: {
        socketType,
        url,
      },
    }
  },
  RM: (name, force = false) => {},
}

const schemas = {
  ADD: {
    type: 'object',
    description: 'Add a new transport.  Will result in a child of this chain.',
    required: ['url'],
    properties: {
      url: { type: 'url' },
      socketType: socketModel.schema.properties.type,
      name: { type: 'string' },
    },
  },
  RM: {
    description: `Removes a transport.  Gracefully attempts to close the connection.
        Force will terminate immediately by deleting the chain`,
  },
  PING: {
    description: `Ping the transport, or the function.  Pings to chain are handled by the chain directly`,
  },
}

const reducer = translator(machine)
module.exports = { actions, schemas, reducer }
